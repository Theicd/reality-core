const BaseConnector = require('./BaseConnector');
const config = require('../config');
const axios = require('axios');
const logger = require('../logger');

class NOAABuoysConnector extends BaseConnector {
  constructor() {
    super('NOAABuoys', config.apis.noaaBuoys);
  }

  async poll() {
    const res = await axios.get(this.url, { timeout: 15000 });
    const allLines = res.data.split('\n').filter(l => l.trim());
    const dataLines = allLines.filter(l => !l.startsWith('#'));
    if (dataLines.length < 1) { this.publish('marine', { items: [], count: 0 }); return []; }
    const results = [];
    for (let i = 0; i < Math.min(dataLines.length, 40); i++) {
      const vals = dataLines[i].split(/\s+/);
      if (vals.length < 15) continue;
      const station = vals[0];
      const lat = this.num(vals[1]);
      const lon = this.num(vals[2]);
      if (!lat || !lon) continue;
      // Positional: STN LAT LON YYYY MM DD HH MM WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
      results.push({
        station,
        windDir: this.num(vals[8]),
        windSpeed: this.num(vals[9]),
        gustSpeed: this.num(vals[10]),
        waveHeight: this.num(vals[11]),
        wavePeriod: this.num(vals[12]),
        pressure: this.num(vals[15]),
        pressureTendency: this.num(vals[20]),
        airTemp: this.num(vals[16]),
        waterTemp: this.num(vals[17]),
        tide: this.num(vals[21]),
        geo: { lat, lon }
      });
    }
    this.publish('marine', { items: results, count: results.length });
    return results;
  }

  num(v) { const n = parseFloat(v); return isNaN(n) || n === 999 || n === 99 ? null : n; }
}

module.exports = NOAABuoysConnector;
