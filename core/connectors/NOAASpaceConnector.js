const BaseConnector = require('./BaseConnector');
const config = require('../config');

class NOAASpaceConnector extends BaseConnector {
  constructor() {
    super('NOAASpace', config.apis.noaaSpace);
  }

  async poll() {
    const [kp, solarWind, alerts] = await Promise.all([
      this.fetch('/noaa-planetary-k-index.json').catch(() => []),
      this.fetch('/solar-wind/plasma-2-hour.json').catch(() => []),
      this.fetch('/alerts.json').catch(() => [])
    ]);

    const latestKp = Array.isArray(kp) && kp.length > 1 ? kp[kp.length - 1] : null;
    const latestWind = Array.isArray(solarWind) && solarWind.length > 1 ? solarWind[solarWind.length - 1] : null;

    const result = {
      kpIndex: latestKp ? parseFloat(latestKp[1]) : null,
      kpHistory: Array.isArray(kp) ? kp.slice(1).map(r => ({ time: r[0], kp: parseFloat(r[1]) })) : [],
      solarWindSpeed: latestWind ? parseFloat(latestWind[2]) : null,
      solarWindDensity: latestWind ? parseFloat(latestWind[1]) : null,
      solarWindHistory: Array.isArray(solarWind) ? solarWind.slice(1).map(r => ({ time: r[0], speed: parseFloat(r[2]), density: parseFloat(r[1]) })) : [],
      alerts: Array.isArray(alerts) ? alerts.slice(0, 10) : [],
      severity: this.calcSeverity(latestKp ? parseFloat(latestKp[1]) : 0)
    };

    this.publish('space_weather', result);
    return result;
  }

  calcSeverity(kp) {
    if (kp >= 8) return 5;
    if (kp >= 6) return 4;
    if (kp >= 5) return 3;
    if (kp >= 4) return 2;
    return 1;
  }
}

module.exports = NOAASpaceConnector;
