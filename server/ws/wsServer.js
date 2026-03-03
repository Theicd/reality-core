const WebSocket = require('ws');
const eventBus = require('../../core/events/eventBus');
const logger = require('../../core/logger');

function setupWebSocket(server, ai) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'welcome', data: { system: 'REALITY CORE', timestamp: new Date().toISOString() } }));

    const handler = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: event.type, data: event.data, timestamp: event.timestamp, source: event.source }));
      }
    };
    eventBus.on('*', handler);

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.action === 'get_data') ws.send(JSON.stringify({ type: 'all_data', data: ai.getLatestData() }));
        if (parsed.action === 'get_alerts') ws.send(JSON.stringify({ type: 'alerts', data: ai.getActiveAlerts() }));
        if (parsed.action === 'ack_alert') ai.acknowledgeAlert(parsed.id);
      } catch (e) { /* ignore */ }
    });

    ws.on('close', () => { eventBus.removeListener('*', handler); logger.info('WebSocket client disconnected'); });
  });

  return wss;
}

module.exports = { setupWebSocket };
