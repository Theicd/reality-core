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

  // ═══ Aircraft — airplanes.live (primary) + OpenSky (fallback) ═══
  async fetchAircraft() {
    clearLayer('aircraft');
    let count = 0;
    // airplanes.live — CORS *, no rate limit issues
    const data = await apiLoad('adsb-api', {
      url: 'https://api.airplanes.live/v2/point/32.08/34.78/250', ttl: 15
    });
    if (data?.ac) {
      for (const a of data.ac) {
        const lat = +a.lat, lon = +a.lon;
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const alt = a.alt_baro === 'ground' ? 0 : (+a.alt_baro || 0);
        const hdg = +a.track || 0;
        const call = (a.flight || a.hex || '').trim();
        const m = addIconMarker('aircraft', lat, lon, getMarkerIcon('aircraft', hdg), {
          size: 20,
          popup: `<b>✈ ${call}</b><br>Alt: ${alt}ft<br>Speed: ${a.gs || '?'}kts<br>Hdg: ${hdg}°<br>Squawk: ${a.squawk || '—'}`
        });
        m.on('click', () => this.selectObject('aircraft', { call, lat, lon, alt, speed: a.gs, hdg, squawk: a.squawk, type: a.t }));
        count++;
      }
    }
    // OpenSky fallback if adsb-api returned nothing
    if (count === 0) {
      const os = await apiLoad('opensky', {
        url: 'https://opensky-network.org/api/states/all?lamin=25&lamax=45&lomin=25&lomax=45', ttl: 60
      });
      if (os?.states) {
        for (const s of os.states) {
          const lon = +s[5], lat = +s[6], alt = +(s[7] || 0) * 3.281;
          if (!isFinite(lat) || !isFinite(lon)) continue;
          const call = (s[1] || s[0] || '').trim();
          addIconMarker('aircraft', lat, lon, getMarkerIcon('aircraft', s[10] || 0), {
            size: 20, popup: `<b>✈ ${call}</b><br>Alt: ${Math.round(alt)}ft<br>Country: ${s[2] || ''}`
          });
          count++;
        }
      }
    }
    this.counts.aircraft = count;
  },

  // ═══ Ships — Digitraffic AIS Finland ═══
  async fetchShips() {
    clearLayer('ships');
    let count = 0;
    const data = await apiLoad('digitraffic-ais', {
      url: 'https://meri.digitraffic.fi/api/ais/v1/locations', ttl: 60
    });
    if (data?.features) {
      const max = Math.min(data.features.length, 2000);
      for (let i = 0; i < max; i++) {
        const f = data.features[i];
        const [lon, lat] = f.geometry?.coordinates || [];
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const p = f.properties || {};
        addCircleMarker('ships', lat, lon, {
          radius: 3, color: '#26c6da', fillColor: '#00bcd4', fillOpacity: 0.6,
          popup: `<b>🚢 MMSI ${p.mmsi || f.mmsi || '?'}</b><br>SOG: ${p.sog || '?'}kts<br>COG: ${p.cog || '?'}°`
        });
        count++;
      }
    }
    this.counts.ships = count;
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
