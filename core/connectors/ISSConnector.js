const BaseConnector = require('./BaseConnector');
const config = require('../config');

class ISSConnector extends BaseConnector {
  constructor() { super('ISS', config.apis.iss); }

  async poll() {
    try {
      const data = await this.fetch('');
      const pos = data.iss_position || {};
      this.publish('iss', {
        geo: { lat: parseFloat(pos.latitude) || 0, lon: parseFloat(pos.longitude) || 0 },
        timestamp: data.timestamp, velocity: 27600, altitude: 408
      });
    } catch (e) { this.status = 'error'; }
  }
}

module.exports = ISSConnector;
