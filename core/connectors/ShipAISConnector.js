const BaseConnector = require('./BaseConnector');
const config = require('../config');

class ShipAISConnector extends BaseConnector {
  constructor() {
    super('ShipAIS', config.apis.shipAIS);
    this.lastGood = [];
  }

  async poll() {
    try {
      const data = await this.fetch('');
      const ships = (data.features || []).slice(0, 200).map(f => {
        const p = f.properties || {};
        const g = f.geometry?.coordinates || [];
        return {
          mmsi: p.mmsi, name: p.name || `SHIP-${p.mmsi}`,
          speed: p.sog || 0, course: p.cog || 0,
          shipType: p.shipType || 0, heading: p.heading || 0,
          geo: { lat: Number(g[1]), lon: Number(g[0]) },
          timestamp: p.timestampExternal
        };
      }).filter(s => Number.isFinite(s.geo.lat) && Number.isFinite(s.geo.lon) && Math.abs(s.geo.lat) <= 90 && Math.abs(s.geo.lon) <= 180);

      let finalShips = ships;
      if (!finalShips.length) {
        finalShips = this.lastGood.length ? this.lastGood : [];
      }

      this.lastGood = finalShips;
      const limitedCoverage = this.isConcentrated(finalShips);
      this.publish('ships', {
        count: finalShips.length,
        items: finalShips,
        source: ships.length ? 'live' : (this.lastGood.length ? 'stale-cache' : 'empty'),
        coverage: {
          limited: limitedCoverage,
          note: limitedCoverage ? 'Regional AIS feed (real positions only)' : 'Live AIS positions'
        }
      });
    } catch (e) { this.status = 'error'; }
  }

  isConcentrated(ships) {
    if (!ships || ships.length < 20) return false;
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    ships.forEach(s => {
      minLat = Math.min(minLat, s.geo.lat);
      maxLat = Math.max(maxLat, s.geo.lat);
      minLon = Math.min(minLon, s.geo.lon);
      maxLon = Math.max(maxLon, s.geo.lon);
    });
    return (maxLat - minLat) < 28 && (maxLon - minLon) < 60;
  }

}

module.exports = ShipAISConnector;
