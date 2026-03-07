/**
 * api-validator.js — Smart API Validation Engine for Reality-Core
 * בודק חיבור + מושך מידע אמיתי + מכבד rate limits
 * כל API מקבל כרטיס עם: סטטוס, זמן תגובה, דוגמת מידע, מרווח רענון
 */

const REFRESH_INTERVALS = {
  'open-meteo': 600, 'met-no': 900, 'nws': 300, 'sunrise-sunset': 86400,
  'noaa-tides': 1800, 'noaa-currents': 1800, 'marine-institute': 3600, 'openseamap': 86400,
  'usgs-earthquake': 300, 'emsc-earthquake': 300, 'gfz-earthquake': 600,
  'seismic-portal': 300, 'geonet-nz': 600,
  'noaa-swpc': 900, 'nasa-donki': 3600, 'solar-wind': 900, 'aurora-forecast': 1800,
  'planetary-k-index': 900, 'solar-flare': 3600, 'radiation-belt': 1800,
  'magnetosphere': 900, 'solar-cycle': 86400,
  'celestrak': 43200, 'norad-tle': 43200, 'starlink': 43200,
  'satellite-map': 86400, 'iss-location': 30, 'open-notify': 3600,
  'opensky': 60, 'adsb-api': 15, 'openflights': 86400, 'digitraffic-ais': 60,
  'nasa-eonet': 1800, 'gdacs': 1800, 'nasa-firms': 3600, 'spc-storms': 1800,
  'gdacs-alerts': 300, 'oref-israel': 5, 'tzevaadom': 5, 'us-alerts-cap': 300
};

const RATE_LIMITS_INFO = {
  'open-meteo':      { max: '10,000/day', perMinute: 7, note: 'ללא מפתח' },
  'met-no':          { max: '20/sec', perMinute: 4, note: 'חובה User-Agent' },
  'nws':             { max: 'generous', perMinute: 10, note: 'חובה User-Agent' },
  'sunrise-sunset':  { max: 'generous', perMinute: 1, note: 'לא משתנה תוך יום' },
  'noaa-tides':      { max: 'generous', perMinute: 2, note: '' },
  'noaa-currents':   { max: 'generous', perMinute: 2, note: '' },
  'marine-institute':{ max: 'generous', perMinute: 1, note: 'ERDDAP' },
  'openseamap':      { max: 'generous', perMinute: 1, note: 'tiles בלבד' },
  'usgs-earthquake': { max: 'generous', perMinute: 10, note: 'Feed מתעדכן כל דקה' },
  'emsc-earthquake': { max: 'generous', perMinute: 5, note: '' },
  'gfz-earthquake':  { max: 'generous', perMinute: 5, note: 'FDSN' },
  'seismic-portal':  { max: 'generous', perMinute: 5, note: '' },
  'geonet-nz':       { max: 'generous', perMinute: 5, note: '' },
  'noaa-swpc':       { max: 'generous', perMinute: 10, note: 'JSON feeds' },
  'nasa-donki':      { max: '1,000/hr', perMinute: 2, note: 'DEMO_KEY מוגבל' },
  'solar-wind':      { max: 'generous', perMinute: 4, note: '' },
  'aurora-forecast': { max: 'generous', perMinute: 2, note: 'קובץ ~900KB' },
  'planetary-k-index':{ max: 'generous', perMinute: 4, note: '' },
  'solar-flare':     { max: '1,000/hr', perMinute: 1, note: 'DEMO_KEY' },
  'radiation-belt':  { max: 'generous', perMinute: 2, note: '' },
  'magnetosphere':   { max: 'generous', perMinute: 4, note: '' },
  'solar-cycle':     { max: 'generous', perMinute: 1, note: 'לא משתנה תוך יום' },
  'celestrak':       { max: 'generous', perMinute: 0.1, note: 'TLE — פעם ב-12 שעות' },
  'norad-tle':       { max: 'generous', perMinute: 0.1, note: '' },
  'starlink':        { max: 'generous', perMinute: 0.1, note: 'קובץ גדול' },
  'satellite-map':   { max: 'generous', perMinute: 0.1, note: 'WMTS tiles' },
  'iss-location':    { max: '1/sec', perMinute: 2, note: '' },
  'open-notify':     { max: 'generous', perMinute: 1, note: '' },
  'opensky':         { max: '100/day (anon)', perMinute: 0.07, note: '429 שכיח — fallback לadsb' },
  'adsb-api':        { max: 'generous', perMinute: 4, note: 'CORS * — מקור עיקרי' },
  'openflights':     { max: 'generous', perMinute: 0.1, note: 'GitHub raw — סטטי' },
  'digitraffic-ais': { max: 'generous', perMinute: 1, note: 'קובץ ~7MB' },
  'nasa-eonet':      { max: 'generous', perMinute: 2, note: '' },
  'gdacs':           { max: 'generous', perMinute: 2, note: '' },
  'nasa-firms':      { max: '10/min', perMinute: 1, note: 'DEMO_KEY' },
  'spc-storms':      { max: 'generous', perMinute: 2, note: '' },
  'gdacs-alerts':    { max: 'generous', perMinute: 2, note: '' },
  'oref-israel':     { max: '-', perMinute: 12, note: 'דורש proxy/server' },
  'tzevaadom':       { max: '-', perMinute: 12, note: 'CORS restricted origin' },
  'us-alerts-cap':   { max: 'generous', perMinute: 10, note: 'חובה User-Agent' }
};

function _vLog(tag, msg) { console.log(`%c[Validator] %c${tag}%c ${msg}`, 'color:#00e5ff', 'color:#ffd600;font-weight:bold', 'color:#ccc'); }
function _vErr(tag, msg) { console.log(`%c[Validator] %c${tag}%c ${msg}`, 'color:#ff5252', 'color:#ffd600;font-weight:bold', 'color:#ff8a80'); }

const _validationResults = {};
let _validationRunning = false;

function getActiveTestableApis() {
  if (typeof API_REGISTRY === 'undefined') return [];
  return Object.entries(API_REGISTRY)
    .filter(([, v]) => v.active && v.testEndpoint && v.cors !== false)
    .map(([k, v]) => ({ key: k, ...v }));
}

async function validateSingleApi(key, api) {
  const t0 = performance.now();
  const timeout = 10000;
  const result = {
    key, name: api.name, category: api.category,
    status: 'pending', httpCode: null, responseTime: null,
    dataSize: null, dataSample: null, dataCount: null,
    fields: [], missingFields: [],
    refreshInterval: REFRESH_INTERVALS[key] || 600,
    rateInfo: RATE_LIMITS_INFO[key] || null,
    error: null, timestamp: Date.now()
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = { 'Accept': 'application/json, text/plain, */*' };
    if (api.headers) Object.assign(headers, api.headers);

    const resp = await fetch(api.testEndpoint, { signal: ctrl.signal, headers });
    clearTimeout(timer);
    result.responseTime = Math.round(performance.now() - t0);
    result.httpCode = resp.status;

    if (!resp.ok) {
      result.status = 'http_error';
      result.error = `HTTP ${resp.status}`;
      return result;
    }

    const contentType = resp.headers.get('content-type') || '';
    const raw = await resp.text();
    result.dataSize = raw.length;

    if (contentType.includes('json') || api.responseType === 'json') {
      try {
        const json = JSON.parse(raw);
        result.status = 'ok';

        // בדיקת שדות צפויים
        if (api.expectedFields?.length) {
          for (const f of api.expectedFields) {
            if (json[f] !== undefined) result.fields.push(f);
            else result.missingFields.push(f);
          }
        }

        // חילוץ דוגמת מידע ומספר פריטים
        const sample = _extractSample(json, key);
        result.dataSample = sample.text;
        result.dataCount = sample.count;
      } catch {
        result.status = 'json_error';
        result.error = 'JSON parse failed';
      }
    } else if (contentType.includes('xml') || api.responseType === 'xml') {
      result.status = 'ok';
      result.dataSample = raw.substring(0, 200) + '...';
    } else if (contentType.includes('image') || api.responseType === 'image') {
      result.status = 'ok';
      result.dataSample = `Image ${(raw.length/1024).toFixed(1)}KB`;
    } else {
      result.status = 'ok';
      const lines = raw.split('\n').filter(l => l.trim());
      result.dataCount = lines.length;
      result.dataSample = lines.slice(0, 3).join(' | ').substring(0, 200);
    }
  } catch (e) {
    result.responseTime = Math.round(performance.now() - t0);
    if (e.name === 'AbortError') {
      result.status = 'timeout';
      result.error = `Timeout ${timeout}ms`;
    } else {
      result.status = 'network_error';
      result.error = e.message;
    }
  }

  return result;
}

function _extractSample(json, key) {
  let text = '', count = null;

  // Weather
  if (json.current_weather) {
    const w = json.current_weather;
    text = `🌡 ${w.temperature}°C, 💨 ${w.windspeed}km/h`;
    count = 1;
  } else if (json.properties?.timeseries) {
    const t = json.properties.timeseries[0]?.data?.instant?.details;
    if (t) text = `🌡 ${t.air_temperature}°C, 💨 ${t.wind_speed}m/s`;
    count = json.properties.timeseries.length;
  }
  // Alerts
  else if (json.features && json.type === 'FeatureCollection') {
    count = json.features.length;
    const f = json.features[0];
    if (f?.properties?.mag !== undefined) {
      text = `🌍 M${f.properties.mag} ${f.properties.place || ''}`;
    } else if (f?.properties?.headline) {
      text = `⚠️ ${f.properties.headline.substring(0, 80)}`;
    } else if (f?.properties?.alertlevel) {
      text = `🚨 ${f.properties.eventtype} ${f.properties.alertlevel} — ${f.properties.country || ''}`;
    } else if (f?.geometry) {
      text = `📍 ${count} features [${f.geometry.type}]`;
    }
  }
  // EONET events
  else if (json.events) {
    count = json.events.length;
    const e = json.events[0];
    if (e) text = `🌎 ${e.title} (${e.categories?.[0]?.title || ''})`;
  }
  // Tides/Currents
  else if (json.data && Array.isArray(json.data)) {
    count = json.data.length;
    const d = json.data[0];
    if (d?.v !== undefined) text = `📏 ${d.v} @ ${d.t}`;
    else text = `📊 ${count} records`;
  }
  // Sunrise
  else if (json.results?.sunrise) {
    text = `🌅 ${json.results.sunrise} → 🌇 ${json.results.sunset}`;
    count = 1;
  }
  // ERDDAP
  else if (json.table) {
    count = json.table.rows?.length || json.table.columnNames?.length;
    text = `📊 ERDDAP: ${count} items`;
  }
  // NASA DONKI
  else if (Array.isArray(json) && json[0]?.messageType) {
    count = json.length;
    text = `☀️ ${json[0].messageType}: ${(json[0].messageBody || '').substring(0, 60)}...`;
  }
  // K-index array
  else if (Array.isArray(json) && json.length > 1 && json[0]?.length >= 2) {
    count = json.length - 1;
    const last = json[json.length - 1];
    text = `📈 Kp=${last[1]} @ ${last[0]}`;
  }
  // ISS
  else if (json.latitude !== undefined && json.longitude !== undefined) {
    text = `🛰 ISS @ ${Number(json.latitude).toFixed(2)}, ${Number(json.longitude).toFixed(2)}`;
    count = 1;
  }
  // Open Notify
  else if (json.people) {
    count = json.people.length;
    text = `👨‍🚀 ${count} people in space`;
  }
  // ADS-B
  else if (json.ac) {
    count = json.ac.length;
    const a = json.ac[0];
    if (a) text = `✈️ ${a.flight?.trim() || a.hex} alt=${a.alt_baro}ft`;
  }
  // Digitraffic
  else if (json.features && json.features[0]?.mmsi) {
    count = json.features.length;
    text = `🚢 ${count} vessels`;
  }
  // FIRMS CSV
  else if (typeof json === 'string') {
    const lines = json.split('\n').filter(l => l.trim());
    count = Math.max(0, lines.length - 1);
    text = `🔥 ${count} fire hotspots`;
  }
  // Generic
  else {
    const keys = Object.keys(json);
    text = `{${keys.slice(0, 5).join(', ')}}`;
    if (Array.isArray(json)) count = json.length;
  }

  return { text: text || '—', count };
}

async function runFullValidation(progressCallback) {
  if (_validationRunning) { _vErr('Run', 'כבר רץ!'); return _validationResults; }
  _validationRunning = true;

  const apis = getActiveTestableApis();
  _vLog('Run', `═══ Validation START — ${apis.length} APIs to test ═══`);

  const batchSize = 5;
  let done = 0;

  for (let i = 0; i < apis.length; i += batchSize) {
    const batch = apis.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(api => validateSingleApi(api.key, api)));

    for (const r of results) {
      _validationResults[r.key] = r;
      done++;
      const icon = r.status === 'ok' ? '✓' : '✗';
      const grade = r.status === 'ok' ? `HTTP ${r.httpCode} ${r.responseTime}ms ${(r.dataSize/1024).toFixed(1)}KB` : r.error;
      (r.status === 'ok' ? _vLog : _vErr)(r.name, `${icon} ${grade}${r.dataSample ? ' → ' + r.dataSample : ''}`);
    }

    if (progressCallback) progressCallback(done, apis.length, results);
    // השהייה קטנה בין batches לא להציף
    if (i + batchSize < apis.length) await new Promise(r => setTimeout(r, 200));
  }

  const ok = Object.values(_validationResults).filter(r => r.status === 'ok').length;
  const fail = Object.values(_validationResults).filter(r => r.status !== 'ok').length;
  _vLog('Run', `═══ Validation DONE — ${ok} OK, ${fail} FAIL out of ${apis.length} ═══`);
  _validationRunning = false;
  return _validationResults;
}

function getValidationSummary() {
  const results = Object.values(_validationResults);
  if (!results.length) return null;
  const ok = results.filter(r => r.status === 'ok');
  const fail = results.filter(r => r.status !== 'ok');
  return {
    total: results.length, ok: ok.length, fail: fail.length,
    percentage: Math.round(ok.length / results.length * 100),
    avgResponseTime: Math.round(ok.reduce((s, r) => s + r.responseTime, 0) / (ok.length || 1)),
    totalDataKB: Math.round(ok.reduce((s, r) => s + (r.dataSize || 0), 0) / 1024),
    byCategory: [...new Set(results.map(r => r.category))].map(cat => {
      const catResults = results.filter(r => r.category === cat);
      return {
        category: cat,
        label: (typeof API_CATEGORIES !== 'undefined' && API_CATEGORIES[cat]?.label) || cat,
        ok: catResults.filter(r => r.status === 'ok').length,
        total: catResults.length
      };
    }),
    results: _validationResults
  };
}

function getRefreshInterval(key) { return REFRESH_INTERVALS[key] || 600; }
function getRateInfo(key) { return RATE_LIMITS_INFO[key] || null; }
function getValidationResults() { return _validationResults; }
function isValidationRunning() { return _validationRunning; }

if (typeof window !== 'undefined') {
  window.REFRESH_INTERVALS = REFRESH_INTERVALS;
  window.RATE_LIMITS_INFO = RATE_LIMITS_INFO;
  window.validateSingleApi = validateSingleApi;
  window.runFullValidation = runFullValidation;
  window.getValidationSummary = getValidationSummary;
  window.getRefreshInterval = getRefreshInterval;
  window.getRateInfo = getRateInfo;
  window.getValidationResults = getValidationResults;
  window.getActiveTestableApis = getActiveTestableApis;
}
