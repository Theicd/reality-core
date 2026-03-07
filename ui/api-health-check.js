/**
 * api-health-check.js — API Health Check Engine
 * בודק כל API: HTTP status, JSON validity, response time, expected fields
 * מייצר דו"ח מצב + ציון לכל מקור
 */

const _HC_LOG = [];
const _HC_RESULTS = {};

function _hcLog(msg) {
  const ts = new Date().toISOString().substr(11, 12);
  _HC_LOG.push(`[${ts}] ${msg}`);
  console.log(`%c[HealthCheck] ${msg}`, 'color:#18ffff;font-weight:bold');
}

/**
 * בדיקת API בודד
 * @returns {{ key, name, status, httpCode, responseTime, hasExpectedFields, dataSize, error, grade }}
 */
async function checkSingleApi(key, api) {
  if (!api.testEndpoint) {
    return { key, name: api.name, status: 'SKIP', httpCode: null, responseTime: null,
      hasExpectedFields: null, dataSize: null, error: 'No test endpoint', grade: '-' };
  }

  const t0 = performance.now();
  try {
    const opts = { signal: AbortSignal.timeout(12000) };
    if (api.headers) opts.headers = api.headers;

    _hcLog(`→ Testing ${api.name} (${key})...`);
    const r = await fetch(api.testEndpoint, opts);
    const responseTime = Math.round(performance.now() - t0);
    const httpCode = r.status;

    if (!r.ok) {
      _hcLog(`✗ ${api.name}: HTTP ${httpCode} (${responseTime}ms)`);
      return { key, name: api.name, status: 'HTTP_ERROR', httpCode, responseTime,
        hasExpectedFields: false, dataSize: 0, error: `HTTP ${httpCode}`, grade: 'D' };
    }

    let dataSize = 0;
    let hasExpectedFields = true;
    let parsedOk = true;

    if (api.responseType === 'json') {
      try {
        const text = await r.text();
        dataSize = text.length;
        const json = JSON.parse(text);
        if (api.expectedFields?.length) {
          for (const f of api.expectedFields) {
            if (!(f in json)) { hasExpectedFields = false; break; }
          }
        }
      } catch (e) {
        parsedOk = false;
        hasExpectedFields = false;
      }
    } else if (api.responseType === 'text') {
      const text = await r.text();
      dataSize = text.length;
    } else if (api.responseType === 'image' || api.responseType === 'xml') {
      const blob = await r.blob();
      dataSize = blob.size;
    } else {
      const text = await r.text();
      dataSize = text.length;
    }

    // Grade calculation
    let grade = 'A';
    if (!parsedOk) grade = 'C';
    else if (!hasExpectedFields && api.expectedFields?.length) grade = 'B';
    if (responseTime > 5000) grade = grade === 'A' ? 'B' : 'C';
    else if (responseTime > 8000) grade = 'C';
    if (dataSize < 10) grade = 'D';

    const status = parsedOk && hasExpectedFields ? 'OK' : (parsedOk ? 'PARTIAL' : 'PARSE_ERROR');
    _hcLog(`✓ ${api.name}: ${status} HTTP ${httpCode} ${responseTime}ms ${(dataSize/1024).toFixed(1)}KB → ${grade}`);

    return { key, name: api.name, status, httpCode, responseTime,
      hasExpectedFields, dataSize, error: null, grade };

  } catch (e) {
    const responseTime = Math.round(performance.now() - t0);
    const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const status = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    _hcLog(`✗ ${api.name}: ${status} — ${e?.message || e} (${responseTime}ms)`);
    return { key, name: api.name, status, httpCode: null, responseTime,
      hasExpectedFields: false, dataSize: 0, error: e?.message || String(e), grade: 'D' };
  }
}

/**
 * בדיקת כל ה-APIs הפעילים עם testEndpoint
 * @param {object} [opts] — { parallel: number, onProgress: fn }
 */
async function runFullHealthCheck(opts = {}) {
  const { parallel = 4, onProgress = null } = opts;
  const apis = getTestableApis();
  const total = apis.length;
  _hcLog(`═══ Health Check START — ${total} APIs to test ═══`);
  const t0 = performance.now();

  const results = [];
  let done = 0;

  // Run in batches
  for (let i = 0; i < apis.length; i += parallel) {
    const batch = apis.slice(i, i + parallel);
    const batchResults = await Promise.all(
      batch.map(api => checkSingleApi(api.key, api))
    );
    results.push(...batchResults);
    done += batch.length;
    if (onProgress) onProgress({ done, total, latest: batchResults });
  }

  // Store results
  const report = {
    timestamp: new Date().toISOString(),
    duration: Math.round(performance.now() - t0),
    total,
    results: {},
    summary: { OK: 0, PARTIAL: 0, HTTP_ERROR: 0, TIMEOUT: 0, NETWORK_ERROR: 0, SKIP: 0 },
    grades: { A: 0, B: 0, C: 0, D: 0 }
  };

  for (const r of results) {
    report.results[r.key] = r;
    _HC_RESULTS[r.key] = r;
    report.summary[r.status] = (report.summary[r.status] || 0) + 1;
    if (r.grade && r.grade !== '-') report.grades[r.grade] = (report.grades[r.grade] || 0) + 1;
  }

  _hcLog(`═══ Health Check DONE in ${report.duration}ms ═══`);
  _hcLog(`  OK: ${report.summary.OK} | PARTIAL: ${report.summary.PARTIAL} | ERROR: ${report.summary.HTTP_ERROR} | TIMEOUT: ${report.summary.TIMEOUT} | NET: ${report.summary.NETWORK_ERROR}`);
  _hcLog(`  Grades: A=${report.grades.A} B=${report.grades.B} C=${report.grades.C} D=${report.grades.D}`);

  return report;
}

/**
 * בדיקת API לפי קטגוריה
 */
async function checkCategory(category) {
  const apis = Object.entries(API_REGISTRY)
    .filter(([, v]) => v.category === category && v.testEndpoint && v.active)
    .map(([k, v]) => ({ key: k, ...v }));

  _hcLog(`→ Checking category: ${category} (${apis.length} APIs)`);
  const results = await Promise.all(apis.map(api => checkSingleApi(api.key, api)));
  return results;
}

/**
 * בדיקה מהירה — רק APIs קריטיים (שבשימוש פעיל)
 */
async function quickHealthCheck() {
  const critical = [
    'open-meteo', 'usgs-earthquake', 'noaa-swpc', 'celestrak',
    'opensky', 'adsb-api', 'digitraffic-ais', 'iss-location',
    'oref-israel', 'tzevaadom', 'nasa-eonet', 'emsc-earthquake'
  ];
  _hcLog(`═══ Quick Health Check — ${critical.length} critical APIs ═══`);
  const results = [];
  for (const key of critical) {
    const api = API_REGISTRY[key];
    if (!api) continue;
    results.push(await checkSingleApi(key, api));
  }
  const ok = results.filter(r => r.status === 'OK').length;
  _hcLog(`═══ Quick Check: ${ok}/${results.length} OK ═══`);
  return results;
}

/**
 * מחזיר סטטוס מלא בפורמט JSON פשוט
 */
function getHealthStatus() {
  const status = {};
  for (const [key, r] of Object.entries(_HC_RESULTS)) {
    if (r.status === 'OK') status[API_REGISTRY[key]?.name || key] = 'OK';
    else if (r.status === 'PARTIAL') status[API_REGISTRY[key]?.name || key] = 'PARTIAL';
    else if (r.status === 'TIMEOUT') status[API_REGISTRY[key]?.name || key] = 'SLOW';
    else if (r.status === 'HTTP_ERROR') status[API_REGISTRY[key]?.name || key] = r.error || 'ERROR';
    else status[API_REGISTRY[key]?.name || key] = r.status;
  }
  return status;
}

function getHealthLog() { return _HC_LOG.slice(); }
function getHealthResults() { return { ..._HC_RESULTS }; }

if (typeof window !== 'undefined') {
  window.runFullHealthCheck = runFullHealthCheck;
  window.quickHealthCheck = quickHealthCheck;
  window.checkCategory = checkCategory;
  window.checkSingleApi = checkSingleApi;
  window.getHealthStatus = getHealthStatus;
  window.getHealthLog = getHealthLog;
  window.getHealthResults = getHealthResults;
}
