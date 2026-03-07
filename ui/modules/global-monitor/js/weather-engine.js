/**
 * weather-engine.js — Fetch & render weather, earthquakes, disasters, solar, radiation
 */

const WX = {
  layers: {},
  counts: { weather: 0, earthquakes: 0, disasters: 0, volcanoes: 0, solar: 0, fires: 0 },
  events: [],

  init() {
    this.layers.weather = addLayerGroup('weather');
    this.layers.earthquakes = addLayerGroup('earthquakes');
    this.layers.disasters = addLayerGroup('disasters');
    this.layers.fires = addLayerGroup('fires');
    this.layers.solar = addLayerGroup('solar');
  },

  async fetchAll() {
    await Promise.allSettled([
      this.fetchWeather(), this.fetchEarthquakes(), this.fetchDisasters(),
      this.fetchFires(), this.fetchSolar()
    ]);
    this.updateUI();
  },

  // ═══ Weather — Open-Meteo grid ═══
  async fetchWeather() {
    clearLayer('weather');
    const cities = [
      [32.08,34.78,'Tel Aviv'],[40.71,-74.01,'New York'],[51.51,-0.12,'London'],
      [48.86,2.35,'Paris'],[35.68,139.69,'Tokyo'],[55.76,37.62,'Moscow'],
      [-33.87,151.21,'Sydney'],[39.91,116.40,'Beijing'],[28.61,77.21,'Delhi'],
      [19.43,-99.13,'Mexico City'],[-23.55,-46.63,'São Paulo'],[1.35,103.82,'Singapore'],
      [37.57,126.98,'Seoul'],[30.04,31.24,'Cairo'],[41.01,28.98,'Istanbul'],
      [-1.29,36.82,'Nairobi'],[25.28,51.52,'Doha'],[-34.60,-58.38,'Buenos Aires']
    ];
    let count = 0;
    const lats = cities.map(c => c[0]).join(',');
    const lons = cities.map(c => c[1]).join(',');
    const data = await apiLoad('open-meteo', {
      url: `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current_weather=true`,
      ttl: 300
    });
    if (data && Array.isArray(data)) {
      data.forEach((d, i) => {
        if (!d?.current_weather) return;
        const w = d.current_weather;
        const c = cities[i];
        addIconMarker('weather', c[0], c[1], getMarkerIcon('weather', w.weathercode >= 61 ? 'rain' : w.weathercode >= 95 ? 'storm' : w.temperature > 35 ? 'hot' : 'clear'), {
          popup: `<b>${c[2]}</b><br>🌡 ${w.temperature}°C<br>💨 ${w.windspeed} km/h<br>🧭 ${w.winddirection}°`
        });
        count++;
      });
    } else if (data?.current_weather) {
      const w = data.current_weather;
      addIconMarker('weather', 32.08, 34.78, getMarkerIcon('weather', 'clear'), {
        popup: `<b>Tel Aviv</b><br>🌡 ${w.temperature}°C<br>💨 ${w.windspeed} km/h`
      });
      count = 1;
    }
    this.counts.weather = count;
  },

  // ═══ Earthquakes — USGS + EMSC ═══
  async fetchEarthquakes() {
    clearLayer('earthquakes');
    let count = 0;
    const data = await apiLoad('usgs-earthquake', {
      url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', ttl: 300
    });
    if (data?.features) {
      for (const f of data.features) {
        const [lon, lat, depth] = f.geometry.coordinates;
        const p = f.properties;
        if (!isFinite(lat) || !isFinite(lon)) continue;
        addIconMarker('earthquakes', lat, lon, getMarkerIcon('earthquake', p.mag), {
          popup: `<b>M${p.mag}</b> ${p.place}<br>עומק: ${depth?.toFixed(1)}km<br>${new Date(p.time).toLocaleString('he-IL')}`
        });
        count++;
        this.addEvent('🌍', `M${p.mag} ${p.place}`, p.time);
      }
    }
    // EMSC supplement
    const emsc = await apiLoad('emsc-earthquake', { ttl: 300 });
    if (emsc?.features) {
      for (const f of emsc.features) {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties;
        if (!isFinite(lat) || !isFinite(lon) || (p.mag || 0) < 3.5) continue;
        addIconMarker('earthquakes', lat, lon, getMarkerIcon('earthquake', p.mag), {
          popup: `<b>M${p.mag}</b> ${p.flynn_region || ''}<br>EMSC`
        });
        count++;
      }
    }
    this.counts.earthquakes = count;
  },

  // ═══ Disasters — NASA EONET + GDACS ═══
  async fetchDisasters() {
    clearLayer('disasters');
    let count = 0;
    const eonet = await apiLoad('nasa-eonet', {
      url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50', ttl: 1800
    });
    if (eonet?.events) {
      for (const ev of eonet.events) {
        const geo = ev.geometry?.[ev.geometry.length - 1];
        if (!geo?.coordinates) continue;
        const [lon, lat] = geo.coordinates;
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const cat = ev.categories?.[0]?.title?.toLowerCase() || '';
        const iconType = cat.includes('fire') ? 'fire' : cat.includes('storm') ? 'disaster' : 'disaster';
        addIconMarker('disasters', lat, lon, getMarkerIcon(iconType, cat.includes('fire') ? 'wildfire' : 'storm'), {
          popup: `<b>${ev.title}</b><br>${ev.categories?.[0]?.title || ''}<br>${geo.date ? new Date(geo.date).toLocaleDateString('he-IL') : ''}`
        });
        count++;
        this.addEvent('🌎', ev.title, geo.date);
      }
    }
    const gdacs = await apiLoad('gdacs', { ttl: 1800 });
    if (gdacs?.features) {
      for (const f of gdacs.features) {
        const [lon, lat] = f.geometry?.coordinates || [];
        const p = f.properties || {};
        if (!isFinite(lat) || !isFinite(lon)) continue;
        addIconMarker('disasters', lat, lon, getMarkerIcon('disaster', p.eventtype || ''), {
          popup: `<b>${p.eventtype} ${p.alertlevel || ''}</b><br>${p.country || ''}<br>${p.fromdate || ''}`
        });
        count++;
      }
    }
    this.counts.disasters = count;
  },

  // ═══ Fires — NASA FIRMS ═══
  async fetchFires() {
    clearLayer('fires');
    let count = 0;
    const csv = await apiLoad('nasa-firms', {
      url: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/DEMO_KEY/VIIRS_SNPP_NRT/world/1', ttl: 3600
    });
    if (typeof csv === 'string') {
      const lines = csv.split('\n');
      const header = lines[0]?.split(',');
      const latI = header?.indexOf('latitude'), lonI = header?.indexOf('longitude'), brI = header?.indexOf('bright_ti4');
      if (latI >= 0 && lonI >= 0) {
        for (let i = 1; i < Math.min(lines.length, 500); i++) {
          const cols = lines[i]?.split(',');
          if (!cols) continue;
          const lat = +cols[latI], lon = +cols[lonI];
          if (!isFinite(lat) || !isFinite(lon)) continue;
          addCircleMarker('fires', lat, lon, { radius: 3, color: '#ff6d00', fillColor: '#ff3d00', fillOpacity: 0.6 });
          count++;
        }
      }
    }
    this.counts.fires = count;
  },

  // ═══ Solar — NOAA SWPC ═══
  async fetchSolar() {
    const kp = await apiLoad('planetary-k-index', { ttl: 900 });
    if (Array.isArray(kp) && kp.length > 1) {
      const last = kp[kp.length - 1];
      this.solarKp = last?.[1] || '?';
    }
    const sw = await apiLoad('solar-wind', {
      url: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', ttl: 900
    });
    if (Array.isArray(sw) && sw.length > 1) {
      const last = sw[sw.length - 1];
      this.solarWindSpeed = last?.[1] || '?';
      this.solarWindDensity = last?.[2] || '?';
    }
  },

  addEvent(icon, text, time) {
    this.events.unshift({ icon, text, time: time ? new Date(time) : new Date() });
    if (this.events.length > 50) this.events.length = 50;
  },

  updateUI() {
    // Layer counts
    document.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.count;
      if (this.counts[key] !== undefined) el.textContent = this.counts[key];
    });
    // Solar panel
    const sp = document.getElementById('solarInfo');
    if (sp) sp.innerHTML = `Kp: <b>${this.solarKp || '—'}</b> | רוח: <b>${this.solarWindSpeed || '—'}</b> km/s`;
    // Events ticker
    const ticker = document.getElementById('eventTicker');
    if (ticker) {
      ticker.innerHTML = this.events.slice(0, 20).map(e =>
        `<div class="ticker-item"><span class="time">${e.time?.toLocaleTimeString?.('he-IL',{hour:'2-digit',minute:'2-digit'}) || ''}</span><span class="icon">${e.icon}</span>${e.text}</div>`
      ).join('');
    }
  }
};
