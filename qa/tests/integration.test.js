// Integration Tests - Tests full data flow
module.exports = async function(qa) {
  // Connector → EventBus flow
  await qa.run('USGS Connector → EventBus', async () => {
    const eventBus = require('../../core/events/eventBus');
    const USGSConnector = require('../../core/connectors/USGSConnector');
    const conn = new USGSConnector();
    let received = false;
    const handler = () => { received = true; };
    eventBus.on('earthquake', handler);
    try {
      await conn.poll();
      qa.assert(received, 'EventBus should receive earthquake event');
    } finally { eventBus.removeListener('earthquake', handler); }
  });

  // Connector → EventBus → AI flow
  await qa.run('Weather → AI Anomaly Pipeline', async () => {
    const AnomalyDetector = require('../../core/ai/AnomalyDetector');
    const det = new AnomalyDetector();
    // Simulate extreme weather
    const anomalies = det.analyze('weather', { items: [
      { city: 'Test', windspeed: 120, temperature: 50, geo: { lat: 0, lon: 0 } }
    ]});
    qa.assert(anomalies.length >= 1, 'Should detect extreme weather anomaly');
    qa.assert(anomalies.some(a => a.category === 'weather'), 'Should be weather category');
  });

  // Full Alert Pipeline
  await qa.run('Full Alert Pipeline', async () => {
    const AlertManager = require('../../core/alerts/AlertManager');
    const AnomalyDetector = require('../../core/ai/AnomalyDetector');
    const am = new AlertManager();
    const det = new AnomalyDetector();
    const anomalies = det.analyze('earthquake', { items: [
      { magnitude: 7.2, place: 'Integration Test', severity: 5, geo: { lat: 35, lon: 139 }, depth: 20 }
    ]});
    qa.assert(anomalies.length > 0, 'Should detect M7.2 anomaly');
    const alert = am.create(anomalies[0]);
    qa.assert(alert.id, 'Alert should be created');
    qa.assert(alert.severity >= 4, 'Severity should be high');
    qa.assert(am.getActive().length > 0, 'Should have active alerts');
  });

  // OpenMeteo Connector poll
  await qa.run('OpenMeteo Connector Poll', async () => {
    const eventBus = require('../../core/events/eventBus');
    const OpenMeteoConnector = require('../../core/connectors/OpenMeteoConnector');
    const conn = new OpenMeteoConnector();
    conn.cities = [{ name: 'Test', lat: 32.08, lon: 34.78 }]; // Only 1 city for speed
    let received = false;
    const handler = () => { received = true; };
    eventBus.on('weather', handler);
    try {
      const results = await conn.poll();
      qa.assert(received, 'EventBus should receive weather event');
      qa.assert(results.length > 0, 'Should have weather data');
      qa.assertType(results[0].temperature, 'number', 'Temperature should be number');
    } finally { eventBus.removeListener('weather', handler); }
  });

  // NOAA Space Connector poll
  await qa.run('NOAA Space Connector Poll', async () => {
    const eventBus = require('../../core/events/eventBus');
    const NOAASpaceConnector = require('../../core/connectors/NOAASpaceConnector');
    const conn = new NOAASpaceConnector();
    let received = false;
    const handler = () => { received = true; };
    eventBus.on('space_weather', handler);
    try {
      const result = await conn.poll();
      qa.assert(received, 'EventBus should receive space_weather event');
      qa.assert(result.kpIndex !== undefined, 'Should have KP index');
    } finally { eventBus.removeListener('space_weather', handler); }
  });

  await qa.run('RedAlertIL Connector inactive publish', async () => {
    const eventBus = require('../../core/events/eventBus');
    const RedAlertILConnector = require('../../core/connectors/RedAlertILConnector');
    const conn = new RedAlertILConnector();
    conn.fetchCurrent = async () => null;
    let payload = null;
    const handler = (e) => { payload = e.data; };
    eventBus.on('israel_alerts', handler);
    try {
      await conn.poll();
      qa.assert(payload, 'Should publish israel_alerts state event');
      qa.assertEqual(payload.active, false, 'Initial state should be inactive');
      qa.assertEqual(payload.source, 'oref', 'Source should be oref');
    } finally { eventBus.removeListener('israel_alerts', handler); }
  });

  await qa.run('RedAlertIL Connector active publish', async () => {
    const eventBus = require('../../core/events/eventBus');
    const RedAlertILConnector = require('../../core/connectors/RedAlertILConnector');
    const conn = new RedAlertILConnector();
    conn.fetchCurrent = async () => ({
      title: 'ירי רקטות וטילים',
      cat: 1,
      data: ['תל אביב - מרכז העיר', 'חולון']
    });
    let redAlertData = null;
    let genericAlert = null;
    const redHandler = (e) => { redAlertData = e.data; };
    const alertHandler = (e) => { genericAlert = e.data; };
    eventBus.on('israel_alerts', redHandler);
    eventBus.on('alert', alertHandler);
    try {
      await conn.poll();
      qa.assert(redAlertData, 'Should publish israel_alerts');
      qa.assertEqual(redAlertData.active, true, 'Red alert payload should be active');
      qa.assertEqual(redAlertData.count, 2, 'Should include area count');
      qa.assert(genericAlert, 'Should also publish generic alert event');
      qa.assertEqual(genericAlert.category, 'ISRAEL RED ALERT', 'Generic alert category mismatch');
    } finally {
      eventBus.removeListener('israel_alerts', redHandler);
      eventBus.removeListener('alert', alertHandler);
    }
  });
};
