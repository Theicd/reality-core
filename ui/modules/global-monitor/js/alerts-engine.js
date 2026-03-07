/**
 * alerts-engine.js — Israel alerts: Oref + Tzeva Adom
 * Real area coordinates from amitfin/oref_alert metadata
 * Pre-alert (cat 14), exit notification, per-area migun countdown, watchlist
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
  _areaMeta: null,
  _watchlist: new Set(),
  _watchEnabled: true,
  _allKnownAreas: [],

  OREF_URL: 'https://www.oref.org.il/WarningMessages/alert/alerts.json',
  TZEVA_URL: 'https://api.tzevaadom.co.il/notifications',
  META_COORDS: 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/area_info.py',
  META_MIGUN: 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/area_to_migun_time.py',

  _buildPaths() {
    const oE = encodeURIComponent(this.OREF_URL), tE = encodeURIComponent(this.TZEVA_URL);
    return [
      { name: 'tzeva-allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${tE}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => j?.contents || '') },
      { name: 'oref-allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${oE}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => j?.contents || '') },
      { name: 'tzeva-codetabs', fn: () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${tE}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw 0; return r.text(); }) },
      { name: 'oref-corsproxy', fn: () => fetch(`https://corsproxy.io/?${oE}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw 0; return r.text(); }) },
      { name: 'tzeva-direct', fn: () => fetch(this.TZEVA_URL, { signal: AbortSignal.timeout(5000) }).then(r => { if (!r.ok) throw 0; return r.text(); }) },
      { name: 'oref-direct', fn: () => fetch(this.OREF_URL, { signal: AbortSignal.timeout(4000), headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => { if (!r.ok) throw 0; return r.text(); }) },
    ];
  },

  EXIT_PATTERNS: ['יכולים לצאת', 'ניתן לצאת', 'האירוע הסתיים', 'הסתיים האירוע', 'הסתיימה ההתרעה', 'ניתן לחזור לשגרה'],
  _isExit(t) { return t && this.EXIT_PATTERNS.some(p => t.includes(p)); },

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

  // ═══ Load REAL area coordinates + migun times from GitHub ═══
  async loadAreaMeta() {
    if (this._areaMeta) return this._areaMeta;
    try {
      const [cText, mText] = await Promise.all([
        fetch(this.META_COORDS, { signal: AbortSignal.timeout(10000) }).then(r => r.text()),
        fetch(this.META_MIGUN, { signal: AbortSignal.timeout(10000) }).then(r => r.text())
      ]);
      const coords = new Map(), migun = new Map();
      const reC = /"([^"]+)"\s*:\s*\{[^}]*?"lat"\s*:\s*([0-9.]+)[^}]*?"lon"\s*:\s*([0-9.]+)/gms;
      let m; while ((m = reC.exec(cText))) coords.set(m[1], { lat: +m[2], lon: +m[3] });
      const reM = /"([^"]+)"\s*:\s*(\d+)/g;
      while ((m = reM.exec(mText))) migun.set(m[1], +m[2]);
      this._areaMeta = { coords, migun };
      this._allKnownAreas = [...coords.keys()].sort((a, b) => a.localeCompare(b, 'he'));
      console.log(`[Alerts] ✓ Loaded ${coords.size} area coords, ${migun.size} migun times`);
    } catch (e) {
      console.warn('[Alerts] ✗ Meta load failed:', e);
      this._areaMeta = { coords: new Map(), migun: new Map() };
    }
    return this._areaMeta;
  },

  async getAreaGeo(area) {
    const meta = await this.loadAreaMeta();
    return meta.coords.get(area) || null;
  },

  async getMigunSeconds(area) {
    const meta = await this.loadAreaMeta();
    const s = meta.migun.get(area);
    return s === undefined ? 90 : s;
  },

  // ═══ Watchlist ═══
  loadWatchlist() {
    try {
      const wl = JSON.parse(localStorage.getItem('gm_watchlist') || '[]');
      if (Array.isArray(wl)) wl.forEach(a => this._watchlist.add(a));
      this._watchEnabled = localStorage.getItem('gm_watchEnabled') !== '0';
    } catch {}
  },
  saveWatchlist() {
    try {
      localStorage.setItem('gm_watchlist', JSON.stringify([...this._watchlist]));
      localStorage.setItem('gm_watchEnabled', this._watchEnabled ? '1' : '0');
    } catch {}
  },
  addWatch(area) { this._watchlist.add(area); this.saveWatchlist(); this.renderWatchlistUI(); },
  removeWatch(area) { this._watchlist.delete(area); this.saveWatchlist(); this.renderWatchlistUI(); },
  toggleWatch() { this._watchEnabled = !this._watchEnabled; this.saveWatchlist(); this.renderWatchlistUI(); },
  filterAreas(areas) {
    if (!this._watchEnabled || !this._watchlist.size) return areas;
    return areas.filter(a => this._watchlist.has(a));
  },

  renderWatchlistUI() {
    const box = document.getElementById('watchlistBox');
    const toggle = document.getElementById('wlToggle');
    if (toggle) { toggle.textContent = this._watchEnabled ? 'ON' : 'OFF'; toggle.style.color = this._watchEnabled ? '#69f0ae' : '#8b949e'; }
    if (!box) return;
    if (!this._watchlist.size) {
      box.innerHTML = '<div style="color:#8b949e;font-size:11px;padding:4px">רשימה ריקה — כל האזורים יוצגו</div>';
      return;
    }
    box.innerHTML = [...this._watchlist].sort((a,b)=>a.localeCompare(b,'he')).map(a =>
      `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;font-size:12px"><span style="flex:1">${a}</span><button onclick="ALERTS.removeWatch('${a}')" style="background:none;border:1px solid rgba(255,23,68,.3);color:#ff5252;padding:1px 6px;border-radius:4px;cursor:pointer;font-size:10px">✕</button></div>`
    ).join('');
  },

  populateSuggestions(query) {
    const dl = document.getElementById('areaSuggestions');
    if (!dl || !query || query.length < 1) { if (dl) dl.innerHTML = ''; return; }
    const q = query.trim().toLowerCase();
    const matches = this._allKnownAreas.filter(a => a.toLowerCase().includes(q) && !this._watchlist.has(a)).slice(0, 15);
    dl.innerHTML = matches.map(a => `<option value="${a}">`).join('');
  },

  init() {
    this.layer = addLayerGroup('alerts');
    this.loadWatchlist();
    this.loadAreaMeta();
  },

  _parse(text) {
    if (!text || text.trim().length < 3) return { active: false };
    try {
      const d = JSON.parse(text);
      if (Array.isArray(d)) {
        if (!d.length) return { active: false };
        const first = d[0];
        const title = first.title || first.desc || '';
        const areas = first.cities || (typeof first.data === 'string' ? first.data.split(',').map(s => s.trim()).filter(Boolean) : first.data) || first.areas || [];
        const cat = first.cat || first.threat || 0;
        if (this._isExit(title)) return { active: false, isExit: true, id: first.notificationId || first.id || `exit-${Date.now()}`, areas, desc: title, category: +cat, timestamp: new Date().toISOString() };
        if (areas.length) return { active: true, id: first.notificationId || first.id || `alert-${Date.now()}`, areas, desc: title, category: +cat, timestamp: new Date().toISOString() };
      } else if (d && typeof d === 'object') {
        const title = d.title || d.desc || '';
        const areas = d.cities || (typeof d.data === 'string' ? d.data.split(',').map(s => s.trim()).filter(Boolean) : d.data) || d.areas || [];
        const cat = d.cat || d.threat || 0;
        if (this._isExit(title)) return { active: false, isExit: true, id: d.id || `exit-${Date.now()}`, areas, desc: title, category: +cat, timestamp: new Date().toISOString() };
        if (areas.length) return { active: true, id: d.id || `alert-${Date.now()}`, areas, desc: title, category: +cat, timestamp: new Date().toISOString() };
      }
    } catch {}
    return { active: false };
  },

  async fetchAlerts() {
    const paths = this._buildPaths();
    let result = null, sourceName = null;
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
      this.current = []; this.isPreAlert = false; this.isExitNotification = false;
      this.updateUI(); return;
    }

    // ═══ Exit notification ═══
    if (result.isExit) {
      this.isExitNotification = true; this.isPreAlert = false; this.current = [];
      if (this._shelterTimerId) { clearInterval(this._shelterTimerId); this._shelterTimerId = null; }
      this.shelterCountdown = null;
      this.history.unshift({ type: 'exit', areas: result.areas, time: new Date(), title: result.desc || 'סיום אירוע' });
      if (this.history.length > 100) this.history.length = 100;
      this.updateUI(); return;
    }

    // ═══ Active alert ═══
    const isPre = result.category === 14;
    this.isPreAlert = isPre; this.isExitNotification = false;
    clearLayer('alerts');

    const typeKey = isPre ? 'preAlert' : 'missiles';
    const typeInfo = this.ALERT_TYPES[typeKey];
    const allAreas = result.areas || [];
    const areas = this.filterAreas(allAreas);

    this.current = [{
      id: result.id, title: result.desc || typeInfo.label,
      areas: allAreas, filteredAreas: areas, type: typeKey, typeInfo, isPre,
      time: new Date(), desc: result.desc || '', category: result.category
    }];

    // Per-area migun countdown (max migun from all alert areas)
    if (!isPre && !this._shelterTimerId) {
      let maxMigun = 0;
      for (const a of areas) {
        const s = await this.getMigunSeconds(a);
        if (s > maxMigun) maxMigun = s;
      }
      if (!maxMigun) maxMigun = 90;
      this.shelterCountdown = maxMigun;
      this._shelterTimerId = setInterval(() => {
        if (this.shelterCountdown > 0) {
          this.shelterCountdown--;
          const el = document.getElementById('shelterTimer');
          if (el) el.textContent = `⏳ נותרו ${this.shelterCountdown} שניות במרחב מוגן`;
        } else {
          clearInterval(this._shelterTimerId); this._shelterTimerId = null;
          const el = document.getElementById('shelterTimer');
          if (el) el.textContent = '✅ ניתן לצאת מהמרחב המוגן (לא התקבלה הודעת סיום רשמית)';
        }
      }, 1000);
    }

    // ═══ Map markers at REAL coordinates ═══
    const color = isPre ? '#ff9100' : '#ff1744';
    for (const area of areas) {
      const geo = await this.getAreaGeo(area);
      const migun = await this.getMigunSeconds(area);
      const lat = geo ? geo.lat : 31.5;
      const lon = geo ? geo.lon : 34.8;
      const circle = L.circle([lat, lon], { radius: isPre ? 2000 : 4000, color, fillColor: color, fillOpacity: 0.25, weight: 2 });
      circle.bindPopup(`<b>${typeInfo.icon} ${area}</b><br>${isPre ? '⏳ התרעה מקדימה — שפרו מיקום' : '🚨 צבע אדום!'}<br>⏱ מיגון: ${migun} שניות<br>${new Date().toLocaleTimeString('he-IL')}`);
      circle.addTo(MAP_LAYERS?.alerts || MAP);
      if (geo && MAP) MAP.flyTo([lat, lon], 10, { duration: 1 });
    }

    this.history.unshift({ type: typeKey, areas: allAreas, time: new Date(), title: result.desc, isPre });
    if (this.history.length > 100) this.history.length = 100;
    this.updateUI();
  },

  async fetchGlobalAlerts() {
    try {
      const r = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO&alertlevel=Orange;Red', { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return;
      const data = await r.json();
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
    } catch {}
  },

  updateUI() {
    const panel = document.getElementById('alertPanel');
    if (!panel) return;

    if (this.isExitNotification) {
      const lastExit = this.history.find(h => h.type === 'exit');
      panel.style.background = 'linear-gradient(135deg, rgba(105,240,174,.15), rgba(105,240,174,.05))';
      panel.innerHTML = `<div style="text-align:center;padding:16px">
        <div style="font-size:36px">✅</div>
        <div style="font-size:18px;font-weight:700;color:#69f0ae;margin:8px 0">סיום אירוע — ניתן לצאת מהמרחב המוגן</div>
        <div style="font-size:13px;color:var(--text)">${lastExit?.title || ''}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${this.lastUpdate?.toLocaleTimeString('he-IL') || '—'} | ${this.lastSource || '—'}</div>
      </div>`;
      this._updateLog(); return;
    }

    if (!this.current.length) {
      panel.style.background = 'var(--bg2)';
      panel.innerHTML = `<div style="text-align:center;padding:16px;color:var(--green)">
        <div style="font-size:28px">✅</div>
        <div style="font-size:14px;margin-top:4px">אין התרעות פעילות</div>
        <div style="font-size:11px;color:var(--muted)">${this.lastUpdate?.toLocaleTimeString('he-IL') || '—'} | ${this.lastSource || '—'}</div>
      </div>`;
      this._updateLog(); return;
    }

    const a = this.current[0];
    const isPre = a.isPre;
    const bc = isPre ? '#ff9100' : '#ff1744';
    panel.style.background = `linear-gradient(135deg, ${bc}22, ${bc}08)`;
    const filtered = a.filteredAreas || a.areas;
    panel.innerHTML = `<div style="padding:12px;border:2px solid ${bc};border-radius:8px;${isPre ? '' : 'animation:blink 1s infinite'}">
      <div style="font-size:22px;display:flex;align-items:center;gap:8px">
        <span>${a.typeInfo.icon}</span>
        <b style="color:${bc}">${isPre ? '⏳ התרעה מקדימה — שפרו מיקום!' : '🚨 צבע אדום!'}</b>
      </div>
      ${isPre ? '<div style="font-size:12px;color:#ff9100;margin:4px 0">⚠ שיגור זוהה — היערכו לכניסה למרחב המוגן</div>' : ''}
      <div style="font-size:14px;margin-top:6px;color:var(--text);line-height:1.6">${filtered.join(', ')}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${a.desc || ''}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">${a.time.toLocaleTimeString('he-IL')} | ${filtered.length}/${a.areas.length} אזורים | ${this.lastSource || '—'}</div>
      <div id="shelterTimer" style="font-size:13px;font-weight:600;color:${bc};margin-top:6px">${this.shelterCountdown != null ? `⏳ נותרו ${this.shelterCountdown} שניות במרחב מוגן` : ''}</div>
    </div>`;
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
