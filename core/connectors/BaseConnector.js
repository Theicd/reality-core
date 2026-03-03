const axios = require('axios');
const logger = require('../logger');
const eventBus = require('../events/eventBus');

class BaseConnector {
  constructor(name, config) {
    this.name = name;
    this.url = config.url;
    this.interval = config.interval;
    this.running = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastFetch = null;
    this.status = 'idle';
  }

  async fetch(endpoint, params = {}) {
    try {
      const url = `${this.url}${endpoint}`;
      logger.info(`[${this.name}] Fetching: ${url}`);
      const res = await axios.get(url, { params, timeout: 15000 });
      this.retryCount = 0;
      this.lastFetch = new Date().toISOString();
      this.status = 'ok';
      return res.data;
    } catch (err) {
      this.retryCount++;
      this.status = 'error';
      logger.error(`[${this.name}] Fetch error (retry ${this.retryCount}): ${err.message}`);
      if (this.retryCount < this.maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * this.retryCount));
        return this.fetch(endpoint, params);
      }
      throw err;
    }
  }

  publish(type, data) {
    return eventBus.publish(type, data, this.name);
  }

  async start() {
    this.running = true;
    this.status = 'running';
    logger.info(`[${this.name}] Started (interval: ${this.interval}ms)`);
    try {
      await this.poll();
    } catch (err) {
      logger.error(`[${this.name}] Initial poll failed, continuing with interval retries: ${err.message}`);
      this.status = 'degraded';
    }
    this._timer = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        this.status = 'degraded';
        logger.error(`[${this.name}] Poll failed: ${err.message}`);
      }
    }, this.interval);
  }

  stop() {
    this.running = false;
    this.status = 'stopped';
    if (this._timer) clearInterval(this._timer);
    logger.info(`[${this.name}] Stopped`);
  }

  async poll() { throw new Error('poll() must be implemented'); }

  getStatus() {
    return { name: this.name, status: this.status, lastFetch: this.lastFetch, retryCount: this.retryCount };
  }
}

module.exports = BaseConnector;
