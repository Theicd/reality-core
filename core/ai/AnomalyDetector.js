const logger = require('../logger');

class AnomalyDetector {
  constructor() {
    this.thresholds = {
      earthquake: { magnitude: 4.5 },
      weather: { windspeed: 80, temperature_high: 45, temperature_low: -30 },
      space: { kpIndex: 5, solarWind: 600 },
      aviation: { densityPerDegree: 50 },
      marine: { waveHeight: 4, windSpeed: 25 }
    };
    this.history = {};
  }

  analyze(type, data) {
    const anomalies = [];
    switch (type) {
      case 'earthquake': anomalies.push(...this.checkEarthquake(data)); break;
      case 'weather': anomalies.push(...this.checkWeather(data)); break;
      case 'space_weather': anomalies.push(...this.checkSpace(data)); break;
      case 'aviation': anomalies.push(...this.checkAviation(data)); break;
      case 'marine': anomalies.push(...this.checkMarine(data)); break;
    }
    this.updateHistory(type, data);
    return anomalies;
  }

  checkEarthquake(data) {
    const a = [];
    for (const eq of (data.items || [])) {
      if (eq.magnitude >= this.thresholds.earthquake.magnitude) {
        a.push({ category: 'earthquake', severity: eq.severity, confidence: 0.95,
          summary: `M${eq.magnitude} earthquake at ${eq.place}`, geo: eq.geo,
          recommended_action: eq.magnitude >= 6 ? 'Tsunami watch recommended' : 'Monitor aftershocks' });
      }
    }
    return a;
  }

  checkWeather(data) {
    const a = [];
    for (const w of (data.items || [])) {
      if (w.windspeed >= this.thresholds.weather.windspeed) {
        a.push({ category: 'weather', severity: 4, confidence: 0.9,
          summary: `Extreme wind ${w.windspeed} km/h at ${w.city}`, geo: w.geo,
          recommended_action: 'Issue wind warning' });
      }
      if (w.temperature >= this.thresholds.weather.temperature_high) {
        a.push({ category: 'weather', severity: 3, confidence: 0.9,
          summary: `Extreme heat ${w.temperature}°C at ${w.city}`, geo: w.geo,
          recommended_action: 'Heat advisory' });
      }
    }
    return a;
  }

  checkSpace(data) {
    const a = [];
    if (data.kpIndex >= this.thresholds.space.kpIndex) {
      a.push({ category: 'solar', severity: Math.min(5, Math.round(data.kpIndex / 2)),
        confidence: 0.87, geo_scope: 'global',
        summary: `Geomagnetic activity KP=${data.kpIndex}`,
        recommended_action: 'Monitor satellite stability' });
    }
    if (data.solarWindSpeed >= this.thresholds.space.solarWind) {
      a.push({ category: 'solar', severity: 3, confidence: 0.8, geo_scope: 'global',
        summary: `High solar wind speed: ${data.solarWindSpeed} km/s`,
        recommended_action: 'Check communication systems' });
    }
    return a;
  }

  checkAviation(data) {
    return [];
  }

  checkMarine(data) {
    const a = [];
    for (const b of (data.items || [])) {
      if (b.waveHeight && b.waveHeight >= this.thresholds.marine.waveHeight) {
        a.push({ category: 'marine', severity: 3, confidence: 0.85,
          summary: `High waves ${b.waveHeight}m at station ${b.station}`, geo: b.geo,
          recommended_action: 'Maritime warning' });
      }
    }
    return a;
  }

  updateHistory(type, data) {
    if (!this.history[type]) this.history[type] = [];
    this.history[type].push({ timestamp: Date.now(), data });
    if (this.history[type].length > 100) this.history[type].shift();
  }
}

module.exports = AnomalyDetector;
