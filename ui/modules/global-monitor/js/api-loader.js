/**
 * api-loader.js — Load & validate APIs from the existing registry
 * Reads from ../../api-registry.js and ../../api-validator.js
 * Provides caching, fallback, and rate-limit-aware fetching
 */

const API_CACHE = {};
const API_STATUS = {};

const CACHE_TTL = {
  weather: 300, ocean: 1800, geology: 300, space: 900,
  satellites: 600, aviation: 15, ships: 60, disaster: 1800,
  radiation: 3600, alerts: 5
};

const FALLBACKS = {
  'opensky': 'adsb-api',
  'usgs-earthquake': 'emsc-earthquake',
  'emsc-earthquake': 'seismic-portal',
  'noaa-tides': 'noaa-currents',
  'nasa-donki': 'noaa-swpc',
  'oref-israel': 'tzevaadom'
};

async function apiLoad(key, opts = {}) {
  const reg = window.API_REGISTRY?.[key];
  if (!reg || !reg.active) return null;

  const ttl = opts.ttl || CACHE_TTL[reg.category] || 300;
  const cached = API_CACHE[key];
  if (cached && Date.now() - cached.ts < ttl * 1000) return cached.data;

  const url = opts.url || reg.testEndpoint;
  if (!url) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 10000);
    const headers = { 'Accept': 'application/json, text/plain, */*', ...(reg.headers || {}), ...(opts.headers || {}) };
    const resp = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const ct = resp.headers.get('content-type') || '';
    let data;
    if (ct.includes('json') || reg.responseType === 'json') data = await resp.json();
    else data = await resp.text();

    API_CACHE[key] = { data, ts: Date.now() };
    API_STATUS[key] = { status: 'ok', code: resp.status, ts: Date.now() };
    return data;
  } catch (e) {
    API_STATUS[key] = { status: 'error', error: e.message, ts: Date.now() };
    const fb = FALLBACKS[key];
    if (fb && !opts._isFallback) {
      console.warn(`[APILoader] ${key} failed → fallback ${fb}`);
      return apiLoad(fb, { ...opts, _isFallback: true });
    }
    return null;
  }
}

function apiCacheGet(key) { return API_CACHE[key]?.data || null; }
function apiStatusAll() { return { ...API_STATUS }; }

function getWorkingApis(category) {
  if (!window.API_REGISTRY) return [];
  return Object.entries(window.API_REGISTRY)
    .filter(([, v]) => v.active && v.cors !== false && (!category || v.category === category))
    .map(([k, v]) => ({ key: k, ...v, status: API_STATUS[k] || null }));
}

async function healthCheckCategory(category) {
  const apis = getWorkingApis(category);
  const results = [];
  for (const api of apis) {
    if (!api.testEndpoint) continue;
    const t0 = performance.now();
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(api.testEndpoint, { signal: ctrl.signal, headers: api.headers || {} });
      results.push({ key: api.key, name: api.name, ok: r.ok, code: r.status, time: Math.round(performance.now() - t0) });
    } catch (e) {
      results.push({ key: api.key, name: api.name, ok: false, error: e.message, time: Math.round(performance.now() - t0) });
    }
  }
  return results;
}
