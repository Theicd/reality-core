// Unit Tests for REALITY CORE
const fs = require('fs');
const path = require('path');

module.exports = async function(qa) {
  // Config
  await qa.run('Config', async () => {
    const config = require('../../core/config');
    qa.assert(config.port > 0, 'Port must be positive');
    qa.assert(config.apis.usgs.url, 'USGS URL missing');
    qa.assert(config.apis.openMeteo.url, 'OpenMeteo URL missing');
    qa.assert(config.apis.openSky.url, 'OpenSky URL missing');
    qa.assert(config.apis.noaaSpace.url, 'NOAA Space URL missing');
    qa.assert(config.apis.noaaBuoys.url, 'NOAA Buoys URL missing');
    qa.assert(config.apis.celestrak.url, 'CelesTrak URL missing');
    qa.assert(config.apis.redAlertIL.url, 'RedAlertIL URL missing');
  });

  await qa.run('Connector Registry', async () => {
    const { connectors } = require('../../core/connectors');
    qa.assert(connectors.redAlertIL, 'RedAlertIL connector missing from registry');
    qa.assertEqual(connectors.redAlertIL.name, 'RedAlertIL', 'RedAlertIL connector name mismatch');
  });

  await qa.run('Launcher BAT Files', async () => {
    const root = path.join(__dirname, '..', '..');
    const serverBat = path.join(root, 'start-reality-core.bat');
    const uiBat = path.join(root, 'start-ui.bat');
    qa.assert(fs.existsSync(serverBat), 'Missing start-reality-core.bat');
    qa.assert(fs.existsSync(uiBat), 'Missing start-ui.bat');
    const serverText = fs.readFileSync(serverBat, 'utf8');
    const uiText = fs.readFileSync(uiBat, 'utf8');
    qa.assert(serverText.includes('node'), 'Server BAT must run node');
    qa.assert(uiText.includes('http://localhost:3000'), 'UI BAT must open localhost UI');
  });

  // Logger
  await qa.run('Logger', async () => {
    const logger = require('../../core/logger');
    qa.assert(logger.info, 'Logger must have info method');
    qa.assert(logger.error, 'Logger must have error method');
    qa.assert(logger.warn, 'Logger must have warn method');
    logger.info('QA test log message');
  });

  // EventBus
  await qa.run('EventBus', async () => {
    const eventBus = require('../../core/events/eventBus');
    let received = null;
    eventBus.on('test_event', (e) => { received = e; });
    const published = eventBus.publish('test_event', { value: 42 }, 'test');
    qa.assert(published.id, 'Event must have id');
    qa.assert(received, 'Event must be received');
    qa.assertEqual(received.data.value, 42, 'Event data must match');
    const history = eventBus.getHistory('test_event', 1);
    qa.assert(history.length === 1, 'History must contain 1 event');
    eventBus.removeAllListeners('test_event');
  });

  // Anomaly Detector
  await qa.run('Anomaly Detector', async () => {
    const AnomalyDetector = require('../../core/ai/AnomalyDetector');
    const det = new AnomalyDetector();
    const eqAnomalies = det.analyze('earthquake', { items: [
      { magnitude: 6.5, place: 'Test', severity: 4, geo: { lat: 0, lon: 0 }, depth: 10 }
    ]});
    qa.assert(eqAnomalies.length > 0, 'Should detect M6.5 earthquake anomaly');
    qa.assertEqual(eqAnomalies[0].category, 'earthquake');

    const spaceAnomalies = det.analyze('space_weather', { kpIndex: 7, solarWindSpeed: 700 });
    qa.assert(spaceAnomalies.length >= 1, 'Should detect high KP anomaly');
  });

  // Correlation Engine
  await qa.run('Correlation Engine', async () => {
    const CorrelationEngine = require('../../core/ai/CorrelationEngine');
    const ce = new CorrelationEngine();
    const insights = ce.correlate({
      space_weather: { kpIndex: 6 },
      aviation: { count: 150, items: [] }
    });
    qa.assert(insights.length > 0, 'Should find solar-aviation correlation');
  });

  // Alert Manager
  await qa.run('Alert Manager', async () => {
    const AlertManager = require('../../core/alerts/AlertManager');
    const am = new AlertManager();
    const alert = am.create({ category: 'test', severity: 3, confidence: 0.9, summary: 'Test alert' });
    qa.assert(alert.id, 'Alert must have id');
    qa.assertEqual(alert.severity, 3);
    qa.assert(am.getActive().length === 1, 'Should have 1 active alert');
    am.acknowledge(alert.id);
    qa.assert(am.getActive().length === 0, 'Should have 0 active alerts after ack');
  });

  // BitNet Bridge
  await qa.run('BitNet Bridge', async () => {
    const BitNetBridge = require('../../core/ai/BitNetBridge');
    const bridge = new BitNetBridge();
    qa.assert(bridge.getStatus, 'Bridge must have getStatus');
    qa.assert(bridge.analyze, 'Bridge must have analyze');
    qa.assert(bridge.parseJSON, 'Bridge must have parseJSON');
    // Test JSON parsing
    const r1 = bridge.parseJSON('{"alert_level":3,"summary":"test"}');
    qa.assert(r1.alert_level === 3, 'Should parse valid JSON');
    const r2 = bridge.parseJSON('Some text {"alert_level":2} more text');
    qa.assert(r2.alert_level === 2, 'Should extract JSON from text');
    const r3 = bridge.parseJSON('plain text no json');
    qa.assert(r3.summary, 'Should fallback for non-JSON');
    // Test init (will detect available mode)
    await bridge.init();
    const status = bridge.getStatus();
    qa.assert(status.mode, 'Should have a mode');
    console.log(`    → BitNet mode: ${status.mode}, available: ${status.available}`);
  });

  // SolarSystem Connector (local calc, no API)
  await qa.run('SolarSystem Connector', async () => {
    const SolarSystemConnector = require('../../core/connectors/SolarSystemConnector');
    const sc = new SolarSystemConnector();
    qa.assert(sc.getMoonPhaseName, 'Should have getMoonPhaseName');
    const phase = sc.getMoonPhaseName(0.5);
    qa.assertEqual(phase, 'Full Moon');
    qa.assertEqual(sc.getMoonPhaseName(0.01), 'New Moon');
    qa.assertEqual(sc.getMoonPhaseName(0.25), 'First Quarter');
  });
};
