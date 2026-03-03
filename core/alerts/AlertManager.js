const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const eventBus = require('../events/eventBus');

class AlertManager {
  constructor() {
    this.alerts = [];
    this.maxAlerts = 200;
  }

  create(anomaly) {
    const alert = {
      id: `alert_${uuidv4().slice(0, 8)}`,
      category: anomaly.category,
      severity: anomaly.severity || 1,
      confidence: anomaly.confidence || 0.5,
      geo_scope: anomaly.geo_scope || (anomaly.geo ? 'local' : 'global'),
      geo: anomaly.geo || null,
      summary: anomaly.summary,
      recommended_action: anomaly.recommended_action || '',
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) this.alerts.pop();
    logger.warn(`ALERT [${alert.severity}]: ${alert.summary}`);
    eventBus.publish('alert', alert, 'AlertManager');
    return alert;
  }

  acknowledge(id) {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) alert.acknowledged = true;
    return alert;
  }

  getActive(minSeverity = 0) {
    return this.alerts.filter(a => !a.acknowledged && a.severity >= minSeverity);
  }

  getAll(limit = 50) { return this.alerts.slice(0, limit); }
}

module.exports = AlertManager;
