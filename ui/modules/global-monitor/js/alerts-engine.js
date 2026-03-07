/**
 * alerts-engine.js — Israel alerts: Oref + Tzeva Adom
 * Supports: pre-alert (category 14), exit notification, shelter countdown, area mapping
 * Based on the proven logic from israel.js fetchPublicRedAlert + handleIsraelAlerts
 */

const ALERTS = {
  current: [],
  history: [],
  lastUpdate: null,
  lastSource: null,
  isPreAlert: false,
  isExitNotification: false,
  shelterCountdown: null,
  _shelterTimerId: null,

  // ═══ URLs ═══
  OREF_URL: 'https://www.oref.org.il/WarningMessages/alert/alerts.json',
  TZEVA_URL: 'https://api.tzevaadom.co.il/notifications',
  OREF_HISTORY: 'https://www.oref.org.il/WarningMessages/History/AlertsHistory.json',

  // ═══ Fetch paths — ordered by reliability from GitHub Pages ═══
  _buildPaths() {
    const orefEnc = encodeURIComponent(this.OREF_URL);
    const tzevaEnc = encodeURIComponent(this.TZEVA_URL);
    return [
      { name: 'tzeva-allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${tzevaEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(j => j?.contents || '') },
      { name: 'oref-allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${orefEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(j => j?.contents || '') },
      { name: 'tzeva-codetabs', fn: () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${tzevaEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) },
      { name: 'oref-corsproxy', fn: () => fetch(`https://corsproxy.io/?${orefEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) },
      { name: 'tzeva-direct', fn: () => fetch(this.TZEVA_URL, { signal: AbortSignal.timeout(5000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) },
      { name: 'oref-direct', fn: () => fetch(this.OREF_URL, { signal: AbortSignal.timeout(4000), headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) },
    ];
  },

  // ═══ Exit notification patterns ═══
  EXIT_PATTERNS: ['יכולים לצאת', 'ניתן לצאת', 'האירוע הסתיים', 'הסתיים האירוע', 'הסתיימה ההתרעה', 'ניתן לחזור לשגרה'],

  _isExit(title) {
    if (!title) return false;
    return this.EXIT_PATTERNS.some(p => title.includes(p));
  },

  ALERT_TYPES: {
    missiles:   { icon: '🚀', label: 'רקטות', color: '#ff1744' },
    radiologicalEvent: { icon: '☢', label: 'אירוע רדיולוגי', color: '#ff6d00' },
    earthQuake: { icon: '🌍', label: 'רעידת אדמה', color: '#ff9100' },
    tsunami:    { icon: '🌊', label: 'צונאמי', color: '#2979ff' },
    hostileAircraftIntrusion: { icon: '✈', label: 'חדירת כלי טיס', color: '#ff1744' },
    hazardousMaterials: { icon: '⚠', label: 'חומ"ס', color: '#ffab00' },
    unconventionalWarfare: { icon: '💥', label: 'לח"ב', color: '#d500f9' },
    drone:      { icon: '⚠', label: 'כלי טיס עוין', color: '#ff1744' },
    preAlert:   { icon: '⏳', label: 'התרעה מקדימה', color: '#ff9100' },
    exit:       { icon: '✅', label: 'סיום אירוע', color: '#69f0ae' }
  },

  init() {
    this.layer = addLayerGroup('alerts');
  },

  // ═══ Parse response — handles both Oref and Tzeva Adom formats ═══
  _parse(text) {
    if (!text || text.trim().length < 3) return { active: false, source: 'empty' };
    try {
      const d = JSON.parse(text);
      if (Array.isArray(d)) {
        if (!d.length) return { active: false, source: 'empty-array' };
        const first = d[0];
        const title = first.title || first.desc || '';
        const areas = first.cities || (typeof first.data === 'string' ? first.data.split(',').map(s => s.trim()).filter(Boolean) : first.data) || first.areas || [];
        const cat = first.cat || first.threat || 0;
        if (this._isExit(title)) {
          return { active: false, isExit: true, id: first.notificationId || first.id || `exit-${Date.now()}`, areas, desc: title, category: cat, timestamp: new Date().toISOString() };
        }
        if (areas.length) {
          return { active: true, id: first.notificationId || first.id || `alert-${Date.now()}`, areas, desc: title, category: Number(cat), timestamp: new Date().toISOString() };
        }
      } else if (d && typeof d === 'object') {
        const title = d.title || d.desc || '';
        const areas = d.cities || (typeof d.data === 'string' ? d.data.split(',').map(s => s.trim()).filter(Boolean) : d.data) || d.areas || [];
        const cat = d.cat || d.threat || 0;
        if (this._isExit(title)) {
          return { active: false, isExit: true, id: d.id || `exit-${Date.now()}`, areas, desc: title, category: cat, timestamp: new Date().toISOString() };
        }
        if (areas.length) {
          return { active: true, id: d.id || `alert-${Date.now()}`, areas, desc: title, category: Number(cat), timestamp: new Date().toISOString() };
        }
      }
    } catch {}
    return { active: false };
  },

  // ═══ Main fetch — tries all paths in order ═══
  async fetchAlerts() {
    const paths = this._buildPaths();
    let result = null;
    let sourceName = null;

    for (const { name, fn } of paths) {
      try {
        const text = await fn();
        if (!text || text.trim().length < 2) continue;
        result = this._parse(text);
        if (result) { sourceName = name; break; }
      } catch {}
    }

    this.lastUpdate = new Date();
    this.lastSource = sourceName;

    if (!result || (!result.active && !result.isExit)) {
      this.current = [];
      this.isPreAlert = false;
      this.isExitNotification = false;
      this.updateUI();
      return;
    }

    // ═══ Exit notification — סיום אירוע ═══
    if (result.isExit) {
      this.isExitNotification = true;
      this.isPreAlert = false;
      this.current = [];
      if (this._shelterTimerId) { clearInterval(this._shelterTimerId); this._shelterTimerId = null; }
      this.shelterCountdown = null;
      this.history.unshift({ type: 'exit', areas: result.areas, time: new Date(), title: result.desc || 'סיום אירוע' });
      if (this.history.length > 100) this.history.length = 100;
      this.updateUI();
      return;
    }

    // ═══ Active alert ═══
    const isPre = result.category === 14;
    this.isPreAlert = isPre;
    this.isExitNotification = false;
    clearLayer('alerts');

    const typeKey = isPre ? 'preAlert' :
      (Object.keys(this.ALERT_TYPES).find(k => (result.category || '').toString().includes(k)) || 'missiles');
    const typeInfo = this.ALERT_TYPES[typeKey];
    const areas = result.areas || [];

    this.current = [{
      id: result.id,
      title: result.desc || typeInfo.label,
      areas, type: typeKey, typeInfo, isPre,
      time: new Date(), desc: result.desc || '',
      category: result.category
    }];

    // Start shelter countdown (default 90s if not pre-alert)
    if (!isPre && !this._shelterTimerId) {
      this.shelterCountdown = 90;
      this._shelterTimerId = setInterval(() => {
        if (this.shelterCountdown > 0) {
          this.shelterCountdown--;
          const el = document.getElementById('shelterTimer');
          if (el) el.textContent = `⏳ נותרו ${this.shelterCountdown} שניות במרחב מוגן`;
        } else {
          clearInterval(this._shelterTimerId);
          this._shelterTimerId = null;
          const el = document.getElementById('shelterTimer');
          if (el) el.textContent = '✅ ניתן לצאת מהמרחב המוגן (לא התקבלה הודעת סיום רשמית)';
        }
      }, 1000);
    }

    // Map markers for alert areas (approximate Israel geo)
    const IL_CENTER = { lat: 31.5, lon: 34.8 };
    for (let i = 0; i < areas.length; i++) {
      const hash = areas[i].split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const lat = IL_CENTER.lat + ((hash % 200) / 1000) - 0.1;
      const lon = IL_CENTER.lon + (((hash >> 8) % 200) / 1000) - 0.1;
      const color = isPre ? '#ff9100' : '#ff1744';
      addIconMarker('alerts', lat, lon, getMarkerIcon(isPre ? 'alert_drone' : 'alert_rocket'), {
        size: 30, popup: `<b>${typeInfo.icon} ${areas[i]}</b><br>${isPre ? 'התרעה מקדימה — שפרו מיקום' : 'צבע אדום!'}<br>${new Date().toLocaleTimeString('he-IL')}`
      });
    }

    this.history.unshift({ type: typeKey, areas, time: new Date(), title: result.desc, isPre });
    if (this.history.length > 100) this.history.length = 100;
    this.updateUI();
  },

  async fetchGlobalAlerts() {
    const data = await apiLoad('gdacs-alerts', {
      url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO&alertlevel=Orange;Red',
      ttl: 300
    });
    if (data?.features) {
      for (const f of data.features) {
        const [lon, lat] = f.geometry?.coordinates || [];
        const p = f.properties || {};
        if (!isFinite(lat) || !isFinite(lon)) continue;
        addIconMarker('alerts', lat, lon, getMarkerIcon('disaster', p.eventtype), {
          popup: `<b>${p.eventtype} ${p.alertlevel}</b><br>${p.country || ''}<br>${p.fromdate || ''}`
        });
      }
    }
  },

  updateUI() {
    const panel = document.getElementById('alertPanel');
    if (!panel) return;

    // ═══ Exit notification ═══
    if (this.isExitNotification) {
      panel.style.background = 'linear-gradient(135deg, rgba(105,240,174,.15), rgba(105,240,174,.05))';
      const lastExit = this.history.find(h => h.type === 'exit');
      panel.innerHTML = `<div style="text-align:center;padding:16px">
        <div style="font-size:36px">✅</div>
        <div style="font-size:18px;font-weight:700;color:#69f0ae;margin:8px 0">סיום אירוע — ניתן לצאת מהמרחב המוגן</div>
        <div style="font-size:13px;color:var(--text)">${lastExit?.title || ''}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">עדכון: ${this.lastUpdate?.toLocaleTimeString('he-IL') || '—'} | מקור: ${this.lastSource || '—'}</div>
      </div>`;
      this._updateLog();
      return;
    }

    // ═══ No alerts ═══
    if (this.current.length === 0) {
      panel.style.background = 'var(--bg2)';
      panel.innerHTML = `<div style="text-align:center;padding:16px;color:var(--green)">
        <div style="font-size:28px">✅</div>
        <div style="font-size:14px;margin-top:4px">אין התרעות פעילות</div>
        <div style="font-size:11px;color:var(--muted)">עדכון: ${this.lastUpdate?.toLocaleTimeString('he-IL') || '—'} | מקור: ${this.lastSource || '—'}</div>
      </div>`;
      this._updateLog();
      return;
    }

    // ═══ Active alert or pre-alert ═══
    const a = this.current[0];
    const isPre = a.isPre;
    const color = isPre ? 'rgba(255,145,0,.15)' : 'rgba(255,23,68,.15)';
    const borderColor = isPre ? '#ff9100' : '#ff1744';
    panel.style.background = `linear-gradient(135deg, ${color}, ${color.replace('.15', '.05')})`;

    let html = `<div style="padding:12px;border:2px solid ${borderColor};border-radius:8px;${isPre ? '' : 'animation:blink 1s infinite'}">
      <div style="font-size:22px;display:flex;align-items:center;gap:8px">
        <span>${a.typeInfo.icon}</span>
        <b style="color:${borderColor}">${isPre ? '⏳ התרעה מקדימה — שפרו מיקום!' : '🚨 צבע אדום!'}</b>
      </div>
      ${isPre ? '<div style="font-size:12px;color:#ff9100;margin:4px 0">⚠ שיגור זוהה — היערכו לכניסה למרחב המוגן</div>' : ''}
      <div style="font-size:14px;margin-top:6px;color:var(--text);line-height:1.6">${a.areas.join(', ')}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${a.desc || ''}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">${a.time.toLocaleTimeString('he-IL')} | ${a.areas.length} אזורים | מקור: ${this.lastSource || '—'}</div>
      <div id="shelterTimer" style="font-size:13px;font-weight:600;color:${borderColor};margin-top:6px">${this.shelterCountdown != null ? `⏳ נותרו ${this.shelterCountdown} שניות במרחב מוגן` : ''}</div>
    </div>`;
    panel.innerHTML = html;
    this._updateLog();
  },

  _updateLog() {
    const log = document.getElementById('alertLog');
    if (!log) return;
    log.innerHTML = this.history.slice(0, 30).map(h => {
      const info = this.ALERT_TYPES[h.type] || this.ALERT_TYPES.missiles;
      const pre = h.isPre ? ' [מקדימה]' : '';
      return `<div class="ticker-item"><span class="time">${h.time.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span><span class="icon">${info.icon||'⚠'}</span>${h.areas?.slice(0,3).join(', ') || h.title}${pre}</div>`;
    }).join('');
  }
};
