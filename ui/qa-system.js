/**
 * qa-system.js — Automated QA System for Reality-Core
 * בדיקות: API, מפה, ביצועים, מובייל, רשת
 */

const QA = {
  results: [],
  startTime: null,
  log: [],

  _log(msg, level = 'info') {
    const ts = new Date().toISOString().substr(11, 12);
    const entry = { ts, msg, level };
    this.log.push(entry);
    const colors = { info: '#18ffff', pass: '#69f0ae', fail: '#ff5252', warn: '#ffab00' };
    console.log(`%c[QA ${ts}] ${msg}`, `color:${colors[level] || colors.info};font-weight:bold`);
  },

  _assert(name, condition, details = '') {
    const r = { name, pass: !!condition, details, time: new Date().toISOString() };
    this.results.push(r);
    this._log(`${r.pass ? '✓' : '✗'} ${name}${details ? ' — ' + details : ''}`, r.pass ? 'pass' : 'fail');
    return r.pass;
  },

  // ═══════════════════════════════════════════════════════
  // 1. API Tests
  // ═══════════════════════════════════════════════════════
  async testApis() {
    this._log('═══ API TESTS ═══');
    const apis = typeof getTestableApis === 'function' ? getTestableApis() : [];
    if (!apis.length) { this._log('No testable APIs found (api-registry not loaded?)', 'warn'); return; }

    let ok = 0, fail = 0;
    for (const api of apis.slice(0, 30)) {
      try {
        const t0 = performance.now();
        const opts = { signal: AbortSignal.timeout(8000) };
        if (api.headers) opts.headers = api.headers;
        const r = await fetch(api.testEndpoint, opts);
        const ms = Math.round(performance.now() - t0);
        const httpOk = r.ok;
        const fast = ms < 3000;

        this._assert(`API:${api.name}:HTTP`, httpOk, `HTTP ${r.status} (${ms}ms)`);
        this._assert(`API:${api.name}:Speed`, fast, `${ms}ms ${fast ? '< 3s' : '>= 3s SLOW'}`);

        if (httpOk && api.responseType === 'json') {
          try {
            const text = await r.text();
            const json = JSON.parse(text);
            this._assert(`API:${api.name}:JSON`, true, `${(text.length / 1024).toFixed(1)}KB`);
            if (api.expectedFields?.length) {
              const hasAll = api.expectedFields.every(f => f in json);
              this._assert(`API:${api.name}:Fields`, hasAll,
                hasAll ? api.expectedFields.join(',') : `Missing: ${api.expectedFields.filter(f => !(f in json)).join(',')}`);
            }
          } catch (e) {
            this._assert(`API:${api.name}:JSON`, false, e?.message);
          }
        }
        if (httpOk) ok++; else fail++;
      } catch (e) {
        this._assert(`API:${api.name}:Reachable`, false, e?.message || String(e));
        fail++;
      }
    }
    this._log(`API Tests: ${ok} OK, ${fail} FAIL out of ${Math.min(apis.length, 30)}`);
  },

  // ═══════════════════════════════════════════════════════
  // 2. Map / Cesium Tests
  // ═══════════════════════════════════════════════════════
  testMap() {
    this._log('═══ MAP TESTS ═══');
    const v = typeof viewer !== 'undefined' ? viewer : (typeof cesiumViewer !== 'undefined' ? cesiumViewer : null);
    this._assert('Map:CesiumLoaded', typeof Cesium !== 'undefined', typeof Cesium !== 'undefined' ? `v${Cesium.VERSION || '?'}` : 'Not loaded');
    this._assert('Map:ViewerExists', !!v, v ? 'OK' : 'No viewer');
    if (!v) return;

    this._assert('Map:EntitiesCollection', !!v.entities, v.entities ? `${v.entities.values.length} entities` : 'No entities');
    this._assert('Map:Scene', !!v.scene, '');
    this._assert('Map:Camera', !!v.scene?.camera, '');
    this._assert('Map:Canvas', !!v.scene?.canvas, v.scene?.canvas ? `${v.scene.canvas.width}x${v.scene.canvas.height}` : '');

    // Layer tests
    if (typeof layerVisible !== 'undefined') {
      const layers = Object.keys(layerVisible);
      this._assert('Map:LayersConfig', layers.length > 0, layers.join(', '));
    }
  },

  // ═══════════════════════════════════════════════════════
  // 3. Data Integrity Tests
  // ═══════════════════════════════════════════════════════
  testData() {
    this._log('═══ DATA TESTS ═══');
    if (typeof live === 'undefined') { this._log('live object not found', 'warn'); return; }

    const sources = [
      { key: 'earthquake', fields: ['items'], minItems: 1 },
      { key: 'weather', fields: ['items'], minItems: 1 },
      { key: 'marine', fields: ['items'], minItems: 0 },
      { key: 'aviation', fields: ['items'], minItems: 1 },
      { key: 'ships', fields: ['items'], minItems: 1 },
      { key: 'satellites', fields: ['items'], minItems: 1 },
      { key: 'iss', fields: ['geo'], minItems: 0 },
      { key: 'space_weather', fields: [], minItems: 0 }
    ];

    for (const src of sources) {
      const data = live[src.key];
      const exists = !!data;
      this._assert(`Data:${src.key}:Exists`, exists, exists ? 'Has data' : 'Empty/null');
      if (exists && src.fields.includes('items')) {
        const items = data.items || [];
        this._assert(`Data:${src.key}:Items`, items.length >= src.minItems,
          `${items.length} items (min: ${src.minItems})`);
        // Validate geo coordinates
        if (items.length > 0 && items[0].geo) {
          const sample = items[0];
          const validGeo = Number.isFinite(sample.geo.lat) && Number.isFinite(sample.geo.lon);
          this._assert(`Data:${src.key}:GeoValid`, validGeo,
            validGeo ? `lat=${sample.geo.lat.toFixed(2)} lon=${sample.geo.lon.toFixed(2)}` : 'Invalid NaN/null');
        }
      }
      if (exists && data.timestamp) {
        const age = Date.now() - new Date(data.timestamp).getTime();
        const fresh = age < 600000; // 10 min
        this._assert(`Data:${src.key}:Fresh`, fresh,
          `${Math.round(age / 1000)}s old ${fresh ? '' : '(STALE > 10min)'}`);
      }
    }
  },

  // ═══════════════════════════════════════════════════════
  // 4. Performance Tests
  // ═══════════════════════════════════════════════════════
  testPerformance() {
    this._log('═══ PERFORMANCE TESTS ═══');
    // Memory
    if (performance.memory) {
      const mem = performance.memory;
      const usedMB = Math.round(mem.usedJSHeapSize / 1048576);
      const totalMB = Math.round(mem.totalJSHeapSize / 1048576);
      this._assert('Perf:Memory', usedMB < 500, `${usedMB}MB / ${totalMB}MB`);
    }

    // Entity count
    const v = typeof viewer !== 'undefined' ? viewer : null;
    if (v?.entities) {
      const count = v.entities.values.length;
      this._assert('Perf:EntityCount', count < 5000, `${count} entities (max 5000)`);
    }

    // DOM elements
    const domCount = document.querySelectorAll('*').length;
    this._assert('Perf:DOMNodes', domCount < 5000, `${domCount} nodes`);

    // Navigation timing
    if (performance.getEntriesByType) {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        const loadTime = Math.round(nav.loadEventEnd - nav.startTime);
        this._assert('Perf:PageLoad', loadTime < 10000, `${loadTime}ms`);
        const domReady = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
        this._assert('Perf:DOMReady', domReady < 5000, `${domReady}ms`);
      }
    }
  },

  // ═══════════════════════════════════════════════════════
  // 5. Mobile / Responsive Tests
  // ═══════════════════════════════════════════════════════
  testMobile() {
    this._log('═══ MOBILE TESTS ═══');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this._assert('Mobile:Viewport', vw > 0 && vh > 0, `${vw}x${vh}`);
    this._assert('Mobile:MetaViewport', !!document.querySelector('meta[name="viewport"]'), '');
    this._assert('Mobile:TouchSupport', 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      `maxTouchPoints=${navigator.maxTouchPoints}`);

    // Check critical UI elements visibility
    const checks = [
      { sel: '#cesiumContainer', name: 'Map Container' },
      { sel: '#statusBar', name: 'Status Bar' },
      { sel: '#alertBar', name: 'Alert Bar' }
    ];
    for (const c of checks) {
      const el = document.querySelector(c.sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        this._assert(`Mobile:${c.name}`, visible, `${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
  },

  // ═══════════════════════════════════════════════════════
  // 6. Network Tests
  // ═══════════════════════════════════════════════════════
  testNetwork() {
    this._log('═══ NETWORK TESTS ═══');
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      this._assert('Net:Type', true, conn.effectiveType || conn.type || 'unknown');
      if (conn.downlink) this._assert('Net:Downlink', conn.downlink > 1, `${conn.downlink} Mbps`);
      if (conn.rtt) this._assert('Net:RTT', conn.rtt < 300, `${conn.rtt}ms`);
    }
    this._assert('Net:Online', navigator.onLine, navigator.onLine ? 'Online' : 'OFFLINE');
    this._assert('Net:Protocol', location.protocol === 'https:' || location.hostname === 'localhost',
      location.protocol);
  },

  // ═══════════════════════════════════════════════════════
  // Run all tests
  // ═══════════════════════════════════════════════════════
  async runAll(opts = {}) {
    this.results = [];
    this.log = [];
    this.startTime = Date.now();
    this._log('╔══════════════════════════════════════╗');
    this._log('║   REALITY-CORE QA — FULL SUITE       ║');
    this._log('╚══════════════════════════════════════╝');

    this.testMap();
    this.testData();
    this.testPerformance();
    this.testMobile();
    this.testNetwork();
    if (opts.includeApis !== false) await this.testApis();

    const elapsed = Date.now() - this.startTime;
    const pass = this.results.filter(r => r.pass).length;
    const fail = this.results.filter(r => !r.pass).length;
    const total = this.results.length;
    const pct = total ? Math.round(pass / total * 100) : 0;

    this._log('═══════════════════════════════════════');
    this._log(`RESULTS: ${pass}/${total} PASSED (${pct}%) — ${fail} FAILED — ${elapsed}ms`);
    this._log('═══════════════════════════════════════');

    return this.getReport();
  },

  /**
   * בדיקה מהירה ללא API tests (< 1 שנייה)
   */
  runQuick() {
    this.results = [];
    this.log = [];
    this.startTime = Date.now();
    this._log('═══ QUICK QA ═══');
    this.testMap();
    this.testData();
    this.testPerformance();
    const pass = this.results.filter(r => r.pass).length;
    const total = this.results.length;
    this._log(`Quick QA: ${pass}/${total} PASSED`);
    return this.getReport();
  },

  getReport() {
    const pass = this.results.filter(r => r.pass).length;
    const fail = this.results.filter(r => !r.pass).length;
    const total = this.results.length;
    return {
      timestamp: new Date().toISOString(),
      duration: this.startTime ? Date.now() - this.startTime : 0,
      total, pass, fail,
      percentage: total ? Math.round(pass / total * 100) : 0,
      results: [...this.results],
      failures: this.results.filter(r => !r.pass),
      log: [...this.log]
    };
  }
};

if (typeof window !== 'undefined') {
  window.QA = QA;
}
