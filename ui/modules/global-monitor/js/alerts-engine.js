/**
 * alerts-engine.js — Israel alerts (Oref) + GDACS global alerts
 */

const ALERTS = {
  current: [],
  history: [],
  lastUpdate: null,

  PROXY_URLS: [
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest='
  ],

  ALERT_TYPES: {
    missiles: { icon: '🚀', label: 'רקטות', color: '#ff1744', sound: true },
    radiologicalEvent: { icon: '☢', label: 'אירוע רדיולוגי', color: '#ff6d00', sound: true },
    earthQuake: { icon: '🌍', label: 'רעידת אדמה', color: '#ff9100', sound: true },
    tsunami: { icon: '🌊', label: 'צונאמי', color: '#2979ff', sound: true },
    hostileAircraftIntrusion: { icon: '✈', label: 'חדירת כלי טיס', color: '#ff1744', sound: true },
    hazardousMaterials: { icon: '⚠', label: 'חומ"ס', color: '#ffab00', sound: true },
    unconventionalWarfare: { icon: '💥', label: 'לח"ב', color: '#d500f9', sound: true },
    drone: { icon: '⚠', label: 'כלי טיס עוין', color: '#ff1744', sound: true }
  },

  init() {
    this.layer = addLayerGroup('alerts');
  },

  async fetchAlerts() {
    // Try direct first (works locally)
    let data = null;
    try {
      const r = await fetch('https://www.oref.org.il/WarningMessages/alert/alerts.json', {
        signal: AbortSignal.timeout(5000),
        headers: { 'Referer': 'https://www.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (r.ok) { const t = await r.text(); if (t.trim()) data = JSON.parse(t); }
    } catch {}

    // Proxy fallback
    if (!data) {
      for (const proxy of this.PROXY_URLS) {
        try {
          const r = await fetch(proxy + encodeURIComponent('https://www.oref.org.il/WarningMessages/alert/alerts.json'), {
            signal: AbortSignal.timeout(6000)
          });
          if (r.ok) { const t = await r.text(); if (t.trim()) { data = JSON.parse(t); break; } }
        } catch {}
      }
    }

    this.lastUpdate = new Date();
    if (!data || (Array.isArray(data) && data.length === 0)) {
      this.current = [];
      this.updateUI();
      return;
    }

    const alerts = Array.isArray(data) ? data : [data];
    clearLayer('alerts');

    for (const a of alerts) {
      const cat = a.cat || '';
      const typeKey = Object.keys(this.ALERT_TYPES).find(k => cat.toString().includes(k)) || 'missiles';
      const typeInfo = this.ALERT_TYPES[typeKey];
      const areas = (a.data || '').split(',').map(s => s.trim()).filter(Boolean);

      this.current.push({
        id: a.id || Date.now(),
        title: a.title || typeInfo.label,
        areas, type: typeKey, typeInfo,
        time: new Date(), desc: a.desc || ''
      });

      this.history.unshift({ type: typeKey, areas, time: new Date(), title: a.title });
      if (this.history.length > 100) this.history.length = 100;
    }
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
    // Alert panel
    const panel = document.getElementById('alertPanel');
    if (!panel) return;

    if (this.current.length === 0) {
      panel.innerHTML = `<div style="text-align:center;padding:16px;color:var(--green)">
        <div style="font-size:28px">✅</div>
        <div style="font-size:14px;margin-top:4px">אין התרעות פעילות</div>
        <div style="font-size:11px;color:var(--muted)">עדכון אחרון: ${this.lastUpdate?.toLocaleTimeString('he-IL') || '—'}</div>
      </div>`;
      panel.style.background = 'var(--bg2)';
      return;
    }

    panel.style.background = 'linear-gradient(135deg, rgba(255,23,68,.15), rgba(255,23,68,.05))';
    let html = '';
    for (const a of this.current) {
      html += `<div style="padding:10px;border:2px solid ${a.typeInfo.color};border-radius:8px;margin-bottom:8px;animation:blink 1s infinite">
        <div style="font-size:20px;display:flex;align-items:center;gap:8px">
          <span>${a.typeInfo.icon}</span>
          <b style="color:${a.typeInfo.color}">${a.typeInfo.label}</b>
        </div>
        <div style="font-size:13px;margin-top:4px;color:var(--text)">${a.areas.join(', ')}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${a.time.toLocaleTimeString('he-IL')}</div>
      </div>`;
    }
    panel.innerHTML = html;

    // History log
    const log = document.getElementById('alertLog');
    if (log) {
      log.innerHTML = this.history.slice(0, 30).map(h => {
        const info = this.ALERT_TYPES[h.type] || {};
        return `<div class="ticker-item"><span class="time">${h.time.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span><span class="icon">${info.icon||'⚠'}</span>${h.areas?.slice(0,3).join(', ') || h.title}</div>`;
      }).join('');
    }
  }
};
