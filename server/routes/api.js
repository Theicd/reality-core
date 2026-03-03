const express = require('express');
const router = express.Router();
const eventBus = require('../../core/events/eventBus');

router.get('/status', (req, res) => {
  const ai = req.app.locals.ai;
  res.json({
    system: 'REALITY CORE',
    uptime: process.uptime(),
    connectors: req.app.locals.getStatuses(),
    ai: ai.getStatus()
  });
});

router.get('/data/:type', (req, res) => {
  const ai = req.app.locals.ai;
  const data = ai.getLatestData();
  const type = req.params.type;
  res.json(data[type] || { error: 'No data for type: ' + type });
});

router.get('/data', (req, res) => {
  res.json(req.app.locals.ai.getLatestData());
});

router.get('/alerts', (req, res) => {
  const min = parseInt(req.query.min_severity) || 0;
  res.json(req.app.locals.ai.getActiveAlerts(min));
});

router.get('/alerts/all', (req, res) => {
  res.json(req.app.locals.ai.getAlerts(100));
});

router.post('/alerts/:id/ack', (req, res) => {
  const alert = req.app.locals.ai.acknowledgeAlert(req.params.id);
  res.json(alert || { error: 'Alert not found' });
});

router.get('/events/:type', (req, res) => {
  res.json(eventBus.getHistory(req.params.type, 50));
});

router.get('/ai/analysis', (req, res) => {
  res.json(req.app.locals.ai.getBitnetAnalysis());
});

router.get('/ai/analysis/:type', (req, res) => {
  res.json(req.app.locals.ai.getBitnetAnalysis(req.params.type) || { error: 'No analysis' });
});

router.get('/ai/history', (req, res) => {
  res.json(req.app.locals.ai.getBitnetHistory(parseInt(req.query.limit) || 20));
});

module.exports = router;
