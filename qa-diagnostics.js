/**
 * QA Diagnostics for Reality-Core Israel Interface
 * Run in browser console: QA.runAll()  or  QA.test('aviation')
 */
const QA = (() => {
  const results = [];
  const log = (cat, status, msg, ms) => {
    const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    const entry = { cat, status, msg, ms };
    results.push(entry);
    console.log(`%c${icon} [QA][${cat}] ${msg}${ms !== undefined ? ` (${ms}ms)` : ''}`, 
      `color:${status === 'OK' ? '#00e676' : status === 'WARN' ? '#ff9100' : '#ff1744'};font-weight:bold`);
    return entry;
  };

  async function testEndpoint(name, url, timeout = 10000) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      const ms = Math.round(performance.now() - t0);
      if (!r.ok) return log(name, 'FAIL', `HTTP ${r.status} from ${url}`, ms);
      const ct = r.headers.get('content-type') || '';
      const size = r.headers.get('content-length') || '?';
      const body = ct.includes('json') ? await r.json() : await r.text();
      const dataSize = typeof body === 'string' ? body.length : JSON.stringify(body).length;
      return log(name, 'OK', `HTTP 200 | ${dataSize} chars | type: ${ct.split(';')[0]}`, ms);
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      return log(name, 'FAIL', `${e?.name || 'Error'}: ${e?.message || e} | URL: ${url}`, ms);
    }
  }

  async function testCorsProxy(name, targetUrl) {
    const enc = encodeURIComponent(targetUrl);
    const proxies = [
      { name: 'allorigins', url: `https://api.allorigins.win/get?url=${enc}` },
      { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy/?quest=${enc}` },
      { name: 'direct', url: targetUrl }
    ];
    for (const p of proxies) {
      const t0 = performance.now();
      try {
        const r = await fetch(p.url, { signal: AbortSignal.timeout(8000) });
        const ms = Math.round(performance.now() - t0);
        if (r.ok) {
          log(name, 'OK', `${p.name} proxy works`, ms);
          return true;
        }
        log(name, 'WARN', `${p.name} returned HTTP ${r.status}`, ms);
      } catch (e) {
        log(name, 'WARN', `${p.name}: ${e?.message || e}`, Math.round(performance.now() - t0));
      }
    }
    log(name, 'FAIL', 'All CORS proxies failed for: ' + targetUrl);
    return false;
  }

  const tests = {
    async earthquake() {
      return testEndpoint('Earthquake', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
    },
    async weather() {
      return testEndpoint('Weather', 'https://api.open-meteo.com/v1/forecast?latitude=32.08&longitude=34.78&current_weather=true');
    },
    async marine() {
      return testEndpoint('Marine', 'https://marine-api.open-meteo.com/v1/marine?latitude=32.0&longitude=34.2&current=wave_height');
    },
    async spaceWeather() {
      await testEndpoint('SpaceWx-KP', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
      return testEndpoint('SpaceWx-Wind', 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json');
    },
    async iss() {
      return testEndpoint('ISS', 'https://api.wheretheiss.at/v1/satellites/25544');
    },
    async aviation() {
      const url = 'https://opensky-network.org/api/states/all?lamin=27&lamax=35.5&lomin=31.8&lomax=37.8';
      const direct = await testEndpoint('Aviation-Direct', url);
      if (direct.status !== 'OK') {
        log('Aviation', 'WARN', 'Direct failed — testing CORS proxies...');
        await testCorsProxy('Aviation-CORS', url);
      }
      return direct;
    },
    async satellites() {
      return testCorsProxy('Satellites', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle');
    },
    async redAlert() {
      return testCorsProxy('RedAlert', 'https://api.tzevaadom.co.il/notifications');
    },
    async areaMetadata() {
      await testCorsProxy('AreaCoords', 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/area_info.py');
      return testCorsProxy('AreaMigun', 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/area_to_migun_time.py');
    },
    async ships() {
      log('Ships', 'WARN', 'No free public AIS API — ships use fallback port data in standalone mode');
      return testEndpoint('Ships-Digitraffic', 'https://meri.digitraffic.fi/api/ais/v1/locations?latitude=32.0&longitude=34.5&radius=500');
    },
    async serverApi() {
      const isGH = location.hostname.endsWith('github.io');
      if (isGH) {
        log('ServerAPI', 'WARN', 'Running on GitHub Pages — server API not available');
        return;
      }
      await testEndpoint('ServerAPI-Data', `${location.origin}/api/data`);
      await testEndpoint('ServerAPI-Alerts', `${location.origin}/api/alerts?min_severity=2`);
      return testEndpoint('ServerAPI-AI', `${location.origin}/api/ai/analysis`);
    },
    async websocket() {
      const isGH = location.hostname.endsWith('github.io');
      if (isGH) { log('WebSocket', 'WARN', 'GitHub Pages — WebSocket not available'); return; }
      return new Promise(resolve => {
        const t0 = performance.now();
        try {
          const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
          const ws = new WebSocket(`${wsProto}://${location.host}/ws`);
          ws.onopen = () => {
            const ms = Math.round(performance.now() - t0);
            log('WebSocket', 'OK', 'Connected', ms);
            ws.close();
            resolve();
          };
          ws.onerror = () => {
            log('WebSocket', 'FAIL', 'Connection error', Math.round(performance.now() - t0));
            resolve();
          };
          setTimeout(() => { ws.close(); log('WebSocket', 'FAIL', 'Timeout 5s'); resolve(); }, 5000);
        } catch (e) { log('WebSocket', 'FAIL', e?.message || e); resolve(); }
      });
    },
    liveDataStatus() {
      const checks = [
        ['earthquake', live?.earthquake?.items?.length],
        ['weather', live?.weather?.items?.length],
        ['marine', live?.marine?.items?.length],
        ['aviation', live?.aviation?.items?.length],
        ['ships', live?.ships?.items?.length],
        ['satellites', live?.satellites?.items?.length],
        ['space_weather', live?.space_weather?.kpIndex !== undefined],
        ['iss', !!live?.iss?.geo]
      ];
      checks.forEach(([name, val]) => {
        if (val) log('LiveData', 'OK', `${name}: ${typeof val === 'number' ? val + ' items' : 'loaded'}`);
        else log('LiveData', 'WARN', `${name}: NO DATA`);
      });
    },
    alertFlowStatus() {
      log('AlertFlow', 'OK', `_standalone: ${typeof _standalone !== 'undefined' ? _standalone : '?'}`);
      log('AlertFlow', 'OK', `lastAlertId: ${typeof lastAlertId !== 'undefined' ? (lastAlertId || '(none)') : '?'}`);
      log('AlertFlow', 'OK', `_lastAlertWasPre: ${typeof _lastAlertWasPre !== 'undefined' ? _lastAlertWasPre : '?'}`);
      log('AlertFlow', 'OK', `_alertStartTime: ${typeof _alertStartTime !== 'undefined' ? (_alertStartTime ? new Date(_alertStartTime).toLocaleTimeString() : '0') : '?'}`);
      log('AlertFlow', 'OK', `_lastActiveAreas: ${typeof _lastActiveAreas !== 'undefined' ? _lastActiveAreas.length + ' areas' : '?'}`);
      log('AlertFlow', 'OK', `_migunTimeoutId: ${typeof _migunTimeoutId !== 'undefined' ? (_migunTimeoutId ? 'ACTIVE' : 'none') : '?'}`);
      log('AlertFlow', 'OK', `_migunCountdownId: ${typeof _migunCountdownId !== 'undefined' ? (_migunCountdownId ? 'ACTIVE' : 'none') : '?'}`);
      log('AlertFlow', 'OK', `_MIN_SHELTER_MS: ${typeof _MIN_SHELTER_MS !== 'undefined' ? _MIN_SHELTER_MS/1000 + 's (' + _MIN_SHELTER_MS/60000 + ' min)' : '?'}`);
    }
  };

  async function runAll() {
    results.length = 0;
    console.log('%c╔══════════════════════════════════════════╗', 'color:#00e5ff;font-weight:bold');
    console.log('%c║   REALITY-CORE QA DIAGNOSTICS v1.0      ║', 'color:#00e5ff;font-weight:bold');
    console.log('%c║   ' + new Date().toISOString() + '   ║', 'color:#00e5ff');
    console.log('%c║   Host: ' + location.hostname.padEnd(32) + '║', 'color:#00e5ff');
    console.log('%c╚══════════════════════════════════════════╝', 'color:#00e5ff;font-weight:bold');

    console.log('\n%c── Environment ──', 'color:#ff9100;font-weight:bold');
    log('Env', 'OK', `URL: ${location.href}`);
    log('Env', 'OK', `Mode: ${location.hostname.endsWith('github.io') ? 'STANDALONE (GitHub Pages)' : 'SERVER'}`);
    log('Env', 'OK', `UserAgent: ${navigator.userAgent.substr(0, 80)}`);
    log('Env', 'OK', `Online: ${navigator.onLine}`);

    console.log('\n%c── Live Data Status ──', 'color:#ff9100;font-weight:bold');
    tests.liveDataStatus();

    console.log('\n%c── Alert Flow Status ──', 'color:#ff9100;font-weight:bold');
    tests.alertFlowStatus();

    console.log('\n%c── API Endpoint Tests ──', 'color:#ff9100;font-weight:bold');
    await tests.earthquake();
    await tests.weather();
    await tests.marine();
    await tests.spaceWeather();
    await tests.iss();
    await tests.aviation();
    await tests.satellites();
    await tests.redAlert();
    await tests.areaMetadata();
    await tests.ships();

    console.log('\n%c── Server/WebSocket Tests ──', 'color:#ff9100;font-weight:bold');
    await tests.serverApi();
    await tests.websocket();

    console.log('\n%c── Summary ──', 'color:#ff9100;font-weight:bold');
    const ok = results.filter(r => r.status === 'OK').length;
    const warn = results.filter(r => r.status === 'WARN').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    console.log(`%c✅ ${ok} passed  ⚠️ ${warn} warnings  ❌ ${fail} failed  (${results.length} total)`,
      `color:${fail ? '#ff1744' : warn ? '#ff9100' : '#00e676'};font-weight:bold;font-size:14px`);

    if (fail > 0) {
      console.log('%c\nFailed tests:', 'color:#ff1744;font-weight:bold');
      results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ [${r.cat}] ${r.msg}`));
    }
    return { ok, warn, fail, total: results.length, details: [...results] };
  }

  async function test(name) {
    if (tests[name]) return tests[name]();
    log('QA', 'FAIL', `Unknown test: ${name}. Available: ${Object.keys(tests).join(', ')}`);
  }

  return { runAll, test, tests, results };
})();

console.log('%c[QA] Diagnostics loaded. Run QA.runAll() or QA.test("aviation")', 'color:#00e5ff;font-weight:bold');
