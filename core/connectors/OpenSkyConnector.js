const BaseConnector = require('./BaseConnector');
const config = require('../config');

class OpenSkyConnector extends BaseConnector {
  constructor() {
    super('OpenSky', config.apis.openSky);
    this.maxRetries = 1;
    this.lastGood = [];
  }

  async poll() {
    try {
      const data = await this.fetch('/states/all', { lamin: -90, lamax: 90, lomin: -180, lomax: 180 });
      const states = (data.states || []).slice(0, 200).map(s => ({
        icao24: s[0],
        callsign: (s[1] || '').trim(),
        country: s[2],
        geo: { lat: s[6], lon: s[5] },
        altitude: s[7],
        velocity: s[9],
        heading: s[10],
        verticalRate: s[11],
        onGround: s[8],
        timestamp: s[3]
      })).filter(s => Number.isFinite(s.geo.lat) && Number.isFinite(s.geo.lon));

      if (states.length > 0) {
        this.lastGood = states;
        this.publish('aviation', { items: states, count: states.length, totalInApi: (data.states || []).length, source: 'opensky' });
        return states;
      }
      throw new Error('OpenSky returned empty state list');
    } catch (err) {
      const fallback = this.lastGood.length ? this.lastGood : this.buildFallbackFlights();
      this.status = 'degraded';
      this.publish('aviation', { items: fallback, count: fallback.length, totalInApi: 0, source: 'fallback' });
      return fallback;
    }
  }

  buildFallbackFlights() {
    const hubs = [
      { n: 'AA101', c: 'US', lat: 40.64, lon: -73.78, h: 70 },
      { n: 'UA220', c: 'US', lat: 41.97, lon: -87.90, h: 120 },
      { n: 'DL304', c: 'US', lat: 33.64, lon: -84.42, h: 230 },
      { n: 'BA117', c: 'UK', lat: 51.47, lon: -0.45, h: 80 },
      { n: 'AF441', c: 'FR', lat: 49.00, lon: 2.55, h: 95 },
      { n: 'LH772', c: 'DE', lat: 50.03, lon: 8.57, h: 140 },
      { n: 'EK208', c: 'AE', lat: 25.25, lon: 55.36, h: 110 },
      { n: 'QR815', c: 'QA', lat: 25.27, lon: 51.61, h: 160 },
      { n: 'TK094', c: 'TR', lat: 41.27, lon: 28.75, h: 200 },
      { n: 'SQ311', c: 'SG', lat: 1.36, lon: 103.99, h: 250 },
      { n: 'CX872', c: 'HK', lat: 22.31, lon: 113.92, h: 300 },
      { n: 'QF012', c: 'AU', lat: -33.94, lon: 151.18, h: 20 },
      { n: 'LA900', c: 'CL', lat: -33.39, lon: -70.79, h: 40 },
      { n: 'AZ610', c: 'IT', lat: 41.80, lon: 12.24, h: 55 },
      { n: 'NH010', c: 'JP', lat: 35.55, lon: 139.78, h: 130 },
      { n: 'AC847', c: 'CA', lat: 43.68, lon: -79.61, h: 180 }
    ];
    return hubs.map((h, i) => ({
      icao24: `sim${i}`,
      callsign: h.n,
      country: h.c,
      geo: { lat: h.lat, lon: h.lon },
      altitude: 9000 + ((i % 5) * 1500),
      velocity: 220 + (i % 7) * 18,
      heading: h.h,
      verticalRate: 0,
      onGround: false,
      timestamp: Date.now()
    }));
  }
}

module.exports = OpenSkyConnector;
