const BaseConnector = require('./BaseConnector');
const config = require('../config');
const logger = require('../logger');

// Keplerian orbital elements (J2000 epoch) - no API needed
const PLANETS = [
  { id:'mercury', name:'Mercury', radius:2439.7, gravity:3.7, density:5427, avgTemp:440, moons:0,
    semiMajorAU:0.387, eccentricity:0.2056, inclination:7.0, orbitalPeriodDays:87.97, rotationHours:1407.6,
    color:'#a0826d', discoveredBy:'Ancient', info:'Closest to the Sun, extreme temperature swings' },
  { id:'venus', name:'Venus', radius:6051.8, gravity:8.87, density:5243, avgTemp:737, moons:0,
    semiMajorAU:0.723, eccentricity:0.0068, inclination:3.4, orbitalPeriodDays:224.7, rotationHours:-5832.5,
    color:'#e8cda0', discoveredBy:'Ancient', info:'Hottest planet, thick CO2 atmosphere, retrograde rotation' },
  { id:'earth', name:'Earth', radius:6371, gravity:9.81, density:5514, avgTemp:288, moons:1,
    semiMajorAU:1.0, eccentricity:0.0167, inclination:0, orbitalPeriodDays:365.25, rotationHours:23.93,
    color:'#4a90d9', discoveredBy:'-', info:'Our home planet, only known body with life' },
  { id:'mars', name:'Mars', radius:3389.5, gravity:3.72, density:3934, avgTemp:210, moons:2,
    semiMajorAU:1.524, eccentricity:0.0934, inclination:1.85, orbitalPeriodDays:687.0, rotationHours:24.62,
    color:'#c1440e', discoveredBy:'Ancient', info:'The Red Planet, largest volcano Olympus Mons' },
  { id:'jupiter', name:'Jupiter', radius:69911, gravity:24.79, density:1326, avgTemp:165, moons:95,
    semiMajorAU:5.203, eccentricity:0.0489, inclination:1.3, orbitalPeriodDays:4332.6, rotationHours:9.93,
    color:'#c88b3a', discoveredBy:'Ancient', info:'Largest planet, Great Red Spot storm' },
  { id:'saturn', name:'Saturn', radius:58232, gravity:10.44, density:687, avgTemp:134, moons:146,
    semiMajorAU:9.537, eccentricity:0.0565, inclination:2.49, orbitalPeriodDays:10759, rotationHours:10.66,
    color:'#ead6a6', discoveredBy:'Ancient', info:'Famous ring system, least dense planet' },
  { id:'uranus', name:'Uranus', radius:25362, gravity:8.87, density:1270, avgTemp:76, moons:28,
    semiMajorAU:19.19, eccentricity:0.0457, inclination:0.77, orbitalPeriodDays:30687, rotationHours:-17.24,
    color:'#7ec8e3', discoveredBy:'William Herschel', info:'Ice giant, rotates on its side, 98° axial tilt' },
  { id:'neptune', name:'Neptune', radius:24622, gravity:11.15, density:1638, avgTemp:72, moons:16,
    semiMajorAU:30.07, eccentricity:0.0113, inclination:1.77, orbitalPeriodDays:60190, rotationHours:16.11,
    color:'#3f54ba', discoveredBy:'Le Verrier & Galle', info:'Windiest planet, supersonic winds up to 2100 km/h' }
];

class SolarSystemConnector extends BaseConnector {
  constructor() {
    super('SolarSystem', { url: '', interval: config.apis.solarSystem?.interval || 60000 });
  }

  async poll() {
    try {
      const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
      const daysSinceJ2000 = (Date.now() - J2000) / 86400000;

      const planets = PLANETS.map(p => ({
        ...p,
        posAngle: ((daysSinceJ2000 / p.orbitalPeriodDays) * 360) % 360,
        distanceFromSunKm: p.semiMajorAU * 149597870.7,
        type: 'planet'
      }));

      const lunarCycle = 29.53059;
      const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
      const daysSinceMoon = (Date.now() - knownNewMoon) / 86400000;
      const moonPhase = (daysSinceMoon % lunarCycle) / lunarCycle;

      const moon = {
        name: 'Moon', radius: 1737.4, gravity: 1.62, density: 3344, avgTemp: 250,
        semiMajorAxis: 384400, orbitalPeriodDays: 27.32, rotationHours: 655.7,
        phaseAngle: moonPhase * 360, phaseName: this.getMoonPhaseName(moonPhase),
        illumination: Math.round((1 - Math.cos(moonPhase * 2 * Math.PI)) / 2 * 100),
        color: '#c0c0c0', info: 'Earth\'s only natural satellite'
      };

      this.status = 'ok';
      this.lastFetch = new Date().toISOString();
      this.publish('solar_system', { planets, moon, sunRadius: 696340 });
    } catch (e) {
      this.status = 'error';
      logger.error(`[SolarSystem] Error: ${e.message}`);
    }
  }

  async start() {
    this.running = true;
    this.status = 'running';
    logger.info(`[${this.name}] Started (interval: ${this.interval}ms)`);
    await this.poll();
    this._timer = setInterval(() => this.poll(), this.interval);
  }

  getMoonPhaseName(phase) {
    if (phase < 0.03 || phase > 0.97) return 'New Moon';
    if (phase < 0.22) return 'Waxing Crescent';
    if (phase < 0.28) return 'First Quarter';
    if (phase < 0.47) return 'Waxing Gibbous';
    if (phase < 0.53) return 'Full Moon';
    if (phase < 0.72) return 'Waning Gibbous';
    if (phase < 0.78) return 'Last Quarter';
    return 'Waning Crescent';
  }
}

module.exports = SolarSystemConnector;
