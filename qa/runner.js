// REALITY CORE - QA Test Runner
const fs = require('fs');
const path = require('path');

class QARunner {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }

  async run(name, fn) {
    const start = Date.now();
    try {
      await fn();
      this.passed++;
      this.results.push({ name, status: 'PASS', time: Date.now() - start });
      console.log(`  ✅ ${name} (${Date.now() - start}ms)`);
    } catch (err) {
      this.failed++;
      this.results.push({ name, status: 'FAIL', error: err.message, time: Date.now() - start });
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  }

  assert(condition, msg) { if (!condition) throw new Error(msg || 'Assertion failed'); }
  assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); }
  assertType(val, type, msg) { if (typeof val !== type) throw new Error(msg || `Expected type ${type}, got ${typeof val}`); }
  assertArray(val, msg) { if (!Array.isArray(val)) throw new Error(msg || 'Expected array'); }

  summary() {
    const total = this.passed + this.failed;
    const elapsed = Date.now() - this.startTime;
    console.log('\n══════════════════════════════════════');
    console.log(`  TOTAL: ${total} | PASS: ${this.passed} | FAIL: ${this.failed} | TIME: ${elapsed}ms`);
    console.log('══════════════════════════════════════\n');
    this.updateProgress();
    return this.failed === 0;
  }

  updateProgress() {
    const progressPath = path.join(__dirname, '..', 'PROGRESS.md');
    try {
      let content = fs.readFileSync(progressPath, 'utf8');
      for (const r of this.results) {
        const status = r.status === 'PASS' ? '✅' : '❌';
        // Update QA column for matching items
        const patterns = this.getPatterns(r.name);
        for (const pat of patterns) {
          const regex = new RegExp(`(\\| ${pat}[^|]*\\| [^|]* \\|) [^|]* \\|`);
          content = content.replace(regex, `$1 ${status} |`);
        }
      }
      fs.writeFileSync(progressPath, content);
      console.log('📋 PROGRESS.md updated');
    } catch (e) { console.log('⚠ Could not update PROGRESS.md:', e.message); }
  }

  getPatterns(testName) {
    const map = {
      'USGS API': ['USGS Earthquakes'], 'Open-Meteo API': ['Open-Meteo Weather'],
      'OpenSky API': ['OpenSky Network'], 'NOAA Space API': ['NOAA Space Weather'],
      'NOAA Buoys API': ['NOAA Ocean/Buoys'], 'CelesTrak API': ['CelesTrak Satellites'],
      'EventBus': ['Event Bus'], 'Logger': ['Logger'], 'Config': ['Config מרכזי'],
      'REST API /status': ['REST API'], 'WebSocket': ['WebSocket Server'],
      'Anomaly Detector': ['Anomaly Detection'], 'Correlation Engine': ['Correlation Engine'],
      'Alert Manager': ['Alert Generator']
    };
    return map[testName] || [];
  }
}

// ==================== RUN ALL TESTS ====================
async function main() {
  console.log('\n🔬 REALITY CORE - QA SYSTEM\n');

  // Unit Tests
  console.log('── UNIT TESTS ──');
  const unit = new QARunner();
  await require('./tests/unit.test')(unit);
  unit.summary();

  // API Tests
  console.log('── API CONNECTOR TESTS ──');
  const api = new QARunner();
  await require('./tests/api.test')(api);
  api.summary();

  // Integration Tests
  console.log('── INTEGRATION TESTS ──');
  const integ = new QARunner();
  await require('./tests/integration.test')(integ);
  integ.summary();

  // Final
  const totalFail = unit.failed + api.failed + integ.failed;
  console.log(totalFail === 0 ? '🎉 ALL TESTS PASSED' : `⚠ ${totalFail} TESTS FAILED`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch(e => { console.error('QA Runner error:', e); process.exit(1); });
