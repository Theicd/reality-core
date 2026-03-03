const BaseConnector = require('./BaseConnector');
const config = require('../config');

class USGSConnector extends BaseConnector {
  constructor() {
    super('USGS', config.apis.usgs);
  }

  async poll() {
    const data = await this.fetch('/summary/all_hour.geojson');
    const events = (data.features || []).map(f => ({
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      depth: f.geometry.coordinates[2],
      geo: { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] },
      severity: this.calcSeverity(f.properties.mag),
      tsunami: f.properties.tsunami
    }));
    this.publish('earthquake', { items: events, count: events.length });
    return events;
  }

  calcSeverity(mag) {
    if (mag >= 7) return 5;
    if (mag >= 5) return 4;
    if (mag >= 4) return 3;
    if (mag >= 2.5) return 2;
    return 1;
  }
}

module.exports = USGSConnector;
