const BaseConnector = require('./BaseConnector');
const config = require('../config');

class CelesTrakConnector extends BaseConnector {
  constructor() {
    super('CelesTrak', config.apis.celestrak);
  }

  async poll() {
    const data = await this.fetch('', { GROUP: 'active', FORMAT: 'json' });
    const sats = (Array.isArray(data) ? data : []).slice(0, 200).map(s => ({
      name: s.OBJECT_NAME,
      noradId: s.NORAD_CAT_ID,
      epoch: s.EPOCH,
      inclination: s.INCLINATION,
      eccentricity: s.ECCENTRICITY,
      meanMotion: s.MEAN_MOTION,
      period: s.PERIOD,
      country: s.COUNTRY_CODE,
      tle1: s.TLE_LINE1 || '',
      tle2: s.TLE_LINE2 || ''
    }));
    this.publish('satellites', { items: sats, count: sats.length });
    return sats;
  }
}

module.exports = CelesTrakConnector;
