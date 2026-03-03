const AnomalyDetector = require('./AnomalyDetector');
const CorrelationEngine = require('./CorrelationEngine');
const BitNetBridge = require('./BitNetBridge');
const AlertManager = require('../alerts/AlertManager');
const eventBus = require('../events/eventBus');
const logger = require('../logger');
const config = require('../config');

class AIEngine {
  constructor() {
    this.anomalyDetector = new AnomalyDetector();
    this.correlationEngine = new CorrelationEngine();
    this.bitnet = new BitNetBridge();
    this.alertManager = new AlertManager();
    this.latestData = {};
    this.running = false;
    this.bitnetQueue = [];
    this.processingBitnet = false;
    this._preferOrefUntil = 0;
  }

  async start() {
    this.running = true;
    await this.bitnet.init();

    const types = ['earthquake', 'weather', 'space_weather', 'aviation', 'marine', 'satellites', 'ships', 'israel_alerts', 'iss', 'solar_system'];
    types.forEach(type => {
      eventBus.on(type, (event) => {
        if (type === 'israel_alerts') {
          const src = event?.data?.source;
          const active = !!event?.data?.active;
          if (src === 'oref') {
            if (active) this._preferOrefUntil = Date.now() + 4 * 60 * 1000;
            else this._preferOrefUntil = 0;
          }
          if (src === 'tzevaadom' && Date.now() < this._preferOrefUntil) return;
        }
        this.latestData[type] = event.data;
        const anomalies = this.anomalyDetector.analyze(type, event.data);
        anomalies.forEach(a => this.alertManager.create(a));
        if (type !== 'satellites' && type !== 'israel_alerts') this.queueBitnetAnalysis(type, event.data);
      });
    });

    this._timer = setInterval(() => {
      const insights = this.correlationEngine.correlate(this.latestData);
      insights.forEach(i => this.alertManager.create(i));
    }, config.aiInterval);

    // BitNet cross-domain correlation every 2 minutes
    this._bitnetCorrelation = setInterval(() => {
      if (Object.keys(this.latestData).length >= 2) {
        this.queueBitnetAnalysis('correlation', this.latestData);
      }
    }, 120000);

    logger.info('AI Engine started' + (this.bitnet.available ? ` [BitNet: ${this.bitnet.mode}]` : ' [BitNet: unavailable]'));
  }

  queueBitnetAnalysis(type, data) {
    if (!this.bitnet.available) return;
    this.bitnetQueue = this.bitnetQueue.filter(q => q.type !== type);
    this.bitnetQueue.push({ type, data, queued: Date.now() });
    if (!this.processingBitnet) this.processBitnetQueue();
  }

  async processBitnetQueue() {
    if (this.processingBitnet || !this.bitnetQueue.length) return;
    this.processingBitnet = true;
    while (this.bitnetQueue.length > 0) {
      const job = this.bitnetQueue.shift();
      try {
        const result = await this.bitnet.analyze(job.type, job.data);
        if (result) {
          eventBus.publish('ai_analysis', { type: job.type, result }, 'BitNet');
          const level = result.alert_level || result.threat_level || 0;
          if (level >= 3) {
            this.alertManager.create({
              category: `bitnet-${job.type}`, severity: Math.min(5, level),
              confidence: result.confidence || 0.7, summary: `[AI] ${result.summary || 'Analysis complete'}`,
              recommended_action: result.recommended_action || '', geo_scope: 'global'
            });
          }
        }
      } catch (e) { logger.error(`BitNet queue error: ${e.message}`); }
    }
    this.processingBitnet = false;
  }

  stop() {
    this.running = false;
    if (this._timer) clearInterval(this._timer);
    if (this._bitnetCorrelation) clearInterval(this._bitnetCorrelation);
    logger.info('AI Engine stopped');
  }

  getStatus() {
    return {
      running: this.running,
      dataTypes: Object.keys(this.latestData),
      activeAlerts: this.alertManager.getActive().length,
      totalAlerts: this.alertManager.alerts.length,
      bitnet: this.bitnet.getStatus()
    };
  }

  getAlerts(limit) { return this.alertManager.getAll(limit); }
  getActiveAlerts(minSeverity) { return this.alertManager.getActive(minSeverity); }
  acknowledgeAlert(id) { return this.alertManager.acknowledge(id); }
  getLatestData() { return this.latestData; }
  getBitnetAnalysis(type) { return this.bitnet.getLastAnalysis(type); }
  getBitnetHistory(limit) { return this.bitnet.getHistory(limit); }
}

module.exports = AIEngine;
