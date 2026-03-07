/**
 * qa-engine.js — QA system for Global Monitor pages
 * Tests APIs, map rendering, mobile, and performance
 */

const QA_ENGINE = {
  results: [],
  log: [],

  _log(msg, level = 'info') {
    const ts = new Date().toLocaleTimeString('he-IL');
    this.log.push({ ts, msg, level });
    console.log(`%c[QA ${ts}]%c ${msg}`, `color:${level === 'fail' ? '#ff5252' : level === 'pass' ? '#69f0ae' : '#8b949e'}`, 'color:#e0e0e0');
  },

  _test(name, fn) {
    try {
      const r = fn();
      this.results.push({ name, pass: !!r, details: r || 'OK' });
      this._log(`${r ? '✓' : '✗'} ${name} — ${r || 'OK'}`, r ? 'pass' : 'fail');
      return !!r;
    } catch (e) {
      this.results.push({ name, pass: false, details: e.message });
      this._log(`✗ ${name} — ${e.message}`, 'fail');
      return false;
    }
  },

  // ═══ API Tests ═══
  async testApis() {
    this._log('═══ API TESTS ═══');
    const apis = typeof getWorkingApis === 'function' ? getWorkingApis() : [];
    let ok = 0, fail = 0;
    for (const api of apis.slice(0, 15)) {
      if (!api.testEndpoint) continue;
      const t0 = performance.now();
      try {
        const r = await fetch(api.testEndpoint, { signal: AbortSignal.timeout(8000), headers: api.headers || {} });
        const ms = Math.round(performance.now() - t0);
        if (r.ok && ms < 3000) {
          this._log(`✓ ${api.name}: HTTP ${r.status} (${ms}ms)`, 'pass');
          ok++;
        } else {
          this._log(`✗ ${api.name}: HTTP ${r.status} (${ms}ms)`, 'fail');
          fail++;
        }
      } catch (e) {
        this._log(`✗ ${api.name}: ${e.message}`, 'fail');
        fail++;
      }
    }
    this._log(`API Tests: ${ok} OK, ${fail} FAIL`);
    return { ok, fail };
  },

  // ═══ Map Tests ═══
  testMap() {
    this._log('═══ MAP TESTS ═══');
    this._test('Map:Loaded', () => typeof MAP !== 'undefined' && MAP ? 'Leaflet loaded' : false);
    this._test('Map:Container', () => document.getElementById('map') ? 'Container exists' : false);
    this._test('Map:Zoom', () => MAP?.getZoom() >= 1 ? `Zoom: ${MAP.getZoom()}` : false);
    this._test('Map:Layers', () => {
      const count = Object.keys(MAP_LAYERS || {}).length;
      return count > 0 ? `${count} layers` : false;
    });
  },

  // ═══ Performance Tests ═══
  testPerformance() {
    this._log('═══ PERFORMANCE TESTS ═══');
    this._test('Perf:Memory', () => {
      const m = performance.memory;
      if (!m) return 'N/A (not Chrome)';
      const mb = Math.round(m.usedJSHeapSize / 1048576);
      return mb < 200 ? `${mb}MB` : false;
    });
    this._test('Perf:DOM', () => {
      const n = document.querySelectorAll('*').length;
      return n < 5000 ? `${n} nodes` : false;
    });
    this._test('Perf:Markers', () => {
      let total = 0;
      for (const lg of Object.values(MAP_LAYERS || {})) total += lg.getLayers?.()?.length || 0;
      return `${total} markers`;
    });
  },

  // ═══ Mobile Tests ═══
  testMobile() {
    this._log('═══ MOBILE TESTS ═══');
    this._test('Mobile:Viewport', () => `${innerWidth}x${innerHeight}`);
    this._test('Mobile:MetaViewport', () => document.querySelector('meta[name="viewport"]') ? 'OK' : false);
    this._test('Mobile:Touch', () => navigator.maxTouchPoints > 0 ? `${navigator.maxTouchPoints} points` : 'No touch');
    this._test('Mobile:Responsive', () => innerWidth < 769 ? 'Mobile layout' : 'Desktop layout');
  },

  // ═══ Run All ═══
  async runAll() {
    this.results = []; this.log = [];
    this._log('╔══════════════════════════════════╗');
    this._log('║  GLOBAL MONITOR QA — FULL SUITE  ║');
    this._log('╚══════════════════════════════════╝');
    const t0 = performance.now();
    this.testMap();
    this.testPerformance();
    this.testMobile();
    await this.testApis();
    const dur = Math.round(performance.now() - t0);
    const pass = this.results.filter(r => r.pass).length;
    const total = this.results.length;
    this._log(`═══ RESULTS: ${pass}/${total} (${Math.round(pass/total*100)}%) — ${dur}ms ═══`);
    this.renderOverlay();
    return { pass, total, percentage: Math.round(pass / total * 100), duration: dur };
  },

  renderOverlay() {
    let el = document.getElementById('qaOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'qaOverlay';
      el.className = 'qa-overlay';
      document.body.appendChild(el);
    }
    const pass = this.results.filter(r => r.pass).length;
    const total = this.results.length;
    const pct = Math.round(pass / total * 100);
    const color = pct >= 80 ? '#69f0ae' : pct >= 50 ? '#ffab00' : '#ff5252';
    el.innerHTML = `<div style="font-weight:600;color:${color};margin-bottom:4px">QA: ${pass}/${total} (${pct}%)</div>` +
      this.results.slice(-8).map(r => `<div class="qa-row"><span style="color:${r.pass ? '#69f0ae' : '#ff5252'}">${r.pass ? '✓' : '✗'} ${r.name}</span></div>`).join('');
  },

  getStatusLog() {
    const status = {};
    if (typeof API_STATUS !== 'undefined') {
      for (const [k, v] of Object.entries(API_STATUS)) status[k] = v.status;
    }
    return status;
  }
};
