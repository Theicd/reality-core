/**
 * transport-engine.js — Fetch & render aircraft, ships, satellites
 */

const TR = {
  layers: {},
  counts: { aircraft: 0, ships: 0, satellites: 0, iss: null },
  selected: null,
  events: [],

  init() {
    this.layers.aircraft = addLayerGroup('aircraft');
    this.layers.ships = addLayerGroup('ships');
    this.layers.satellites = addLayerGroup('satellites');
  },

  async fetchAll() {
    await Promise.allSettled([
      this.fetchAircraft(), this.fetchShips(), this.fetchSatellites(), this.fetchISS()
    ]);
    this.updateUI();
  },

  // ═══ Military hex ranges (same as israel.js) ═══
  _MIL_HEX: [['ae','af','צבא ארה"ב'],['43c','43c','UK Military'],['3b','3b','French Military'],['3e','3e','German Military'],['150','15f','Russian Military'],['4b8','4bf','Turkish Military'],['730','737','Iranian Military'],['778','77f','Syrian Military'],['e4','e4','NATO']],

  _classifyAircraft(hex, callsign, country, category) {
    const h = (hex || '').toLowerCase();
    for (const [lo, hi, label] of this._MIL_HEX) {
      if (h >= lo && h <= hi + 'ffff') return { mil: true, label };
    }
    const cs = (callsign || '').trim().toUpperCase();
    if (!cs && country && country !== 'Israel') return { mil: true, label: `${country} (ללא callsign)` };
    if (+category === 14) return { mil: true, label: `UAV ${country || ''}` };
    return { mil: false, label: '' };
  },

  // ═══ Aircraft — GLOBAL coverage via airplanes.live ═══
  async fetchAircraft() {
    clearLayer('aircraft');
    let count = 0;
    // Global scan — multiple points for worldwide coverage
    const points = [
      [32.08, 34.78, 250],  // Israel/Middle East
      [51.47, -0.46, 250],  // London/Europe
      [40.64, -73.78, 250], // New York
      [35.55, 139.78, 250], // Tokyo
      [1.36, 103.99, 250],  // Singapore
      [25.25, 55.36, 250],  // Dubai
    ];
    for (const [lat, lon, radius] of points) {
      try {
        const data = await apiLoad(`adsb-${lat.toFixed(0)}-${lon.toFixed(0)}`, {
          url: `https://api.airplanes.live/v2/point/${lat.toFixed(2)}/${lon.toFixed(2)}/${radius}`, ttl: 15
        });
        if (!data?.ac) continue;
        for (const a of data.ac) {
          const aLat = +a.lat, aLon = +a.lon;
          if (!isFinite(aLat) || !isFinite(aLon)) continue;
          const alt = a.alt_baro === 'ground' ? 0 : (+a.alt_baro || 0);
          const hdg = +a.track || 0;
          const call = (a.flight || '').trim();
          const hex = a.hex || '';
          const cls = this._classifyAircraft(hex, call, a.r, a.t);
          const isMil = cls.mil || (a.dbFlags & 1) === 1;
          const milLabel = cls.label || ((a.dbFlags & 1) === 1 ? `MIL ${a.r||''}` : '');
          const col = isMil ? '#ff1744' : '#ffd600';
          const icon = getMarkerIcon(isMil ? 'aircraft_mil' : 'aircraft', hdg);
          const photoId = `ph_${hex}_${Date.now()}`;
          const popupHtml = `<div id="${photoId}" style="max-width:200px"></div>`
            + `<b style="color:${col}">${isMil ? '⚠ ' : '✈ '}${call || hex}</b>`
            + (isMil ? `<br><span style="color:#ff1744;font-weight:700">${milLabel}</span>` : '')
            + `<br>ICAO: ${hex} | ${a.r || ''}`
            + `<br>גובה: ${alt}ft | מהירות: ${a.gs || '?'}kts`
            + `<br>כיוון: ${hdg}° | Squawk: ${a.squawk || '—'}`
            + (a.t ? `<br>סוג: ${a.t}` : '');
          const m = addIconMarker('aircraft', aLat, aLon, icon, { size: isMil ? 24 : 20, popup: popupHtml });
          // Load photo from planespotters on popup open
          if (hex) {
            m.on('popupopen', () => {
              const el = document.getElementById(photoId);
              if (!el || el.dataset.loaded) return;
              el.dataset.loaded = '1';
              fetch(`https://api.planespotters.net/pub/photos/hex/${hex}`, { signal: AbortSignal.timeout(5000) })
                .then(r => r.json()).then(j => {
                  const src = j?.photos?.[0]?.thumbnail_large?.src || j?.photos?.[0]?.thumbnail?.src;
                  if (src) el.innerHTML = `<img src="${src}" style="width:100%;border-radius:4px;margin-bottom:4px" alt="aircraft">`;
                }).catch(() => {});
            });
          }
          count++;
        }
      } catch {}
    }
    this.counts.aircraft = count;
  },

  // ═══ Ships — Digitraffic AIS + vessel metadata + global fallback ═══
  _vesselMeta: null,

  async _loadVesselMeta() {
    if (this._vesselMeta) return this._vesselMeta;
    try {
      const r = await fetch('https://meri.digitraffic.fi/api/ais/v1/vessels', { signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const arr = await r.json();
      this._vesselMeta = new Map();
      (Array.isArray(arr) ? arr : []).forEach(v => { if (v.mmsi) this._vesselMeta.set(v.mmsi, v); });
      return this._vesselMeta;
    } catch { return new Map(); }
  },

  _shipTypeName(t) {
    if (t >= 80 && t <= 89) return 'מכלית';
    if (t >= 70 && t <= 79) return 'מטען';
    if (t >= 60 && t <= 69) return 'נוסעים';
    if (t === 35) return 'צבאי';
    if (t >= 30 && t <= 39) return 'שירות';
    return 'כלי שיט';
  },

  // Global shipping routes — major ports and trade routes worldwide
  _GLOBAL_ROUTES: [
    // Mediterranean
    {name:'Haifa Cargo',lat:32.82,lon:35.00,h:270,t:70,dst:'ILHFA'},
    {name:'Ashdod Container',lat:31.83,lon:34.63,h:250,t:70,dst:'ILASH'},
    {name:'Suez Transit N',lat:31.25,lon:32.31,h:45,t:80,dst:'EGPSD'},
    {name:'Suez Transit S',lat:30.0,lon:32.58,h:180,t:70,dst:'EGPSD'},
    {name:'Limassol Ferry',lat:34.65,lon:33.03,h:90,t:60,dst:'CYLMS'},
    {name:'Piraeus Express',lat:37.94,lon:23.65,h:300,t:60,dst:'GRPIR'},
    {name:'Istanbul Ferry',lat:41.0,lon:29.0,h:200,t:60,dst:'TRIST'},
    {name:'Mersin Link',lat:36.6,lon:34.6,h:180,t:60,dst:'TRMER'},
    {name:'Alexandria Cargo',lat:31.2,lon:29.9,h:90,t:70,dst:'EGALY'},
    {name:'Algiers Tanker',lat:36.77,lon:3.06,h:0,t:80,dst:'DZALG'},
    {name:'Barcelona Cruise',lat:41.35,lon:2.17,h:170,t:60,dst:'ESBCN'},
    {name:'Genoa Cargo',lat:44.41,lon:8.93,h:210,t:70,dst:'ITGOA'},
    {name:'Marseille Tanker',lat:43.30,lon:5.36,h:180,t:80,dst:'FRMRS'},
    // Atlantic & Europe
    {name:'Rotterdam Container',lat:51.95,lon:4.1,h:270,t:70,dst:'NLRTM'},
    {name:'Hamburg Cargo',lat:53.55,lon:9.97,h:0,t:70,dst:'DEHAM'},
    {name:'Antwerp Bulker',lat:51.27,lon:4.40,h:300,t:70,dst:'BEANR'},
    {name:'Southampton',lat:50.90,lon:-1.40,h:180,t:60,dst:'GBSOU'},
    {name:'Le Havre Tanker',lat:49.48,lon:0.12,h:250,t:80,dst:'FRLEH'},
    // Asia & Pacific
    {name:'Singapore Tanker',lat:1.26,lon:103.85,h:60,t:80,dst:'SGSIN'},
    {name:'Shanghai Container',lat:31.23,lon:121.47,h:90,t:70,dst:'CNSHA'},
    {name:'Tokyo Bay Cargo',lat:35.62,lon:139.77,h:180,t:70,dst:'JPTYO'},
    {name:'Busan Express',lat:35.10,lon:129.03,h:0,t:70,dst:'KRPUS'},
    {name:'Hong Kong Ferry',lat:22.29,lon:114.17,h:90,t:60,dst:'HKHKG'},
    // Red Sea & Gulf
    {name:'Bab el-Mandeb',lat:12.6,lon:43.3,h:0,t:80,dst:'DJJIB'},
    {name:'Jeddah Tanker',lat:21.5,lon:39.2,h:270,t:80,dst:'SAJED'},
    {name:'Dubai Cargo',lat:25.28,lon:55.28,h:90,t:70,dst:'AEJEA'},
    {name:'Hormuz Transit',lat:26.5,lon:56.5,h:60,t:80,dst:'OMMUS'},
    // Americas
    {name:'NY/NJ Container',lat:40.66,lon:-74.04,h:180,t:70,dst:'USNYC'},
    {name:'Houston Tanker',lat:29.73,lon:-95.01,h:180,t:80,dst:'USHOU'},
    {name:'Panama Canal E',lat:9.38,lon:-79.92,h:270,t:70,dst:'PAPCN'},
    {name:'Santos Cargo',lat:-23.96,lon:-46.30,h:90,t:70,dst:'BRSSZ'},
    // Africa
    {name:'Cape Town',lat:-33.92,lon:18.43,h:0,t:70,dst:'ZACPT'},
    {name:'Lagos Tanker',lat:6.43,lon:3.42,h:180,t:80,dst:'NGLOS'},
  ],

  async fetchShips() {
    clearLayer('ships');
    let realCount = 0;

    // 1) Digitraffic AIS — real ships (Finland/Baltic)
    const [meta, data] = await Promise.all([
      this._loadVesselMeta(),
      apiLoad('digitraffic-ais', { url: 'https://meri.digitraffic.fi/api/ais/v1/locations', ttl: 60 })
    ]);
    if (data?.features) {
      const max = Math.min(data.features.length, 1500);
      for (let i = 0; i < max; i++) {
        const f = data.features[i];
        const [lon, lat] = f.geometry?.coordinates || [];
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const p = f.properties || {};
        const v = meta?.get?.(p.mmsi) || {};
        const sType = v.shipType || 0;
        const sog = p.sog != null ? (p.sog / 10).toFixed(1) : '?';
        addIconMarker('ships', lat, lon, getMarkerIcon('ship', sType), {
          size: 22,
          popup: `<b>🚢 ${v.name || 'MMSI ' + (p.mmsi||'?')}</b><br>סוג: ${this._shipTypeName(sType)}<br>מהירות: ${sog}kts<br>יעד: ${v.destination || '—'}<br>MMSI: ${p.mmsi || '—'}`
        });
        realCount++;
      }
    }

    // 2) Global route ships — simulate major shipping routes
    for (const p of this._GLOBAL_ROUTES) {
      const lat = p.lat + (Math.random() - .5) * .15;
      const lon = p.lon + (Math.random() - .5) * .15;
      const sog = (5 + Math.random() * 15).toFixed(1);
      addIconMarker('ships', lat, lon, getMarkerIcon('ship', p.t), {
        size: 22,
        popup: `<b>🚢 ${p.name}</b><br>סוג: ${this._shipTypeName(p.t)}<br>מהירות: ${sog}kts<br>יעד: ${p.dst}<br><span style="color:#8b949e">🟡 simulated route</span>`
      });
    }

    this.counts.ships = realCount + this._GLOBAL_ROUTES.length;
  },

  // ═══ Satellites — ISS + Open Notify ═══
  async fetchISS() {
    const data = await apiLoad('iss-location', {
      url: 'https://api.wheretheiss.at/v1/satellites/25544', ttl: 30
    });
    if (data?.latitude && data?.longitude) {
      const lat = +data.latitude, lon = +data.longitude;
      if (isFinite(lat) && isFinite(lon)) {
        addIconMarker('satellites', lat, lon, getMarkerIcon('iss'), {
          size: 28, popup: `<b>🛰 ISS</b><br>Lat: ${lat.toFixed(2)}<br>Lon: ${lon.toFixed(2)}<br>Alt: ${(+data.altitude || 0).toFixed(0)}km<br>Vel: ${(+data.velocity || 0).toFixed(0)}km/h`
        });
        this.counts.iss = { lat, lon, alt: data.altitude, vel: data.velocity };
      }
    }
  },

  async fetchSatellites() {
    // Open Notify — people in space
    const people = await apiLoad('open-notify', {
      url: 'http://api.open-notify.org/astros.json', ttl: 3600
    });
    if (people?.people) {
      this.astronauts = people.people;
      this.counts.satellites = people.number || people.people.length;
    }
  },

  selectObject(type, data) {
    this.selected = { type, ...data };
    const panel = document.getElementById('selectedInfo');
    if (!panel) return;
    let html = `<div class="info-card"><div class="title">${type === 'aircraft' ? '✈' : '🚢'} ${data.call || data.mmsi || '?'}</div>`;
    for (const [k, v] of Object.entries(data)) {
      if (k === 'call' || v == null) continue;
      html += `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`;
    }
    html += '</div>';
    panel.innerHTML = html;
  },

  updateUI() {
    document.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.count;
      if (this.counts[key] !== undefined) {
        el.textContent = typeof this.counts[key] === 'object' ? '1' : this.counts[key];
      }
    });
    // ISS info
    const issEl = document.getElementById('issInfo');
    if (issEl && this.counts.iss) {
      const d = this.counts.iss;
      issEl.innerHTML = `🛰 ISS: ${(+d.lat).toFixed(1)}°, ${(+d.lon).toFixed(1)}° | Alt: ${(+d.alt).toFixed(0)}km`;
    }
    // Astronauts
    const astEl = document.getElementById('astronauts');
    if (astEl && this.astronauts) {
      astEl.innerHTML = this.astronauts.map(a => `<div class="ticker-item"><span class="icon">👨‍🚀</span>${a.name} (${a.craft})</div>`).join('');
    }
  }
};
