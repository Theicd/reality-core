const logger = require('../logger');

class CorrelationEngine {
  constructor() {
    this.rules = [
      { a: 'space_weather', b: 'aviation', check: this.solarAviation.bind(this) },
      { a: 'weather', b: 'marine', check: this.weatherMarine.bind(this) },
      { a: 'earthquake', b: 'marine', check: this.earthquakeTsunami.bind(this) }
    ];
  }

  correlate(events) {
    const insights = [];
    for (const rule of this.rules) {
      const a = events[rule.a], b = events[rule.b];
      if (a && b) {
        const result = rule.check(a, b);
        if (result) insights.push(result);
      }
    }
    return insights;
  }

  solarAviation(space, aviation) {
    if (space.kpIndex >= 5 && aviation.count > 100) {
      return { type: 'correlation', category: 'solar-aviation', severity: 3,
        confidence: 0.7, summary: `High KP (${space.kpIndex}) may affect GPS for ${aviation.count} tracked aircraft`,
        recommended_action: 'Monitor navigation systems' };
    }
    return null;
  }

  weatherMarine(weather, marine) {
    const windyCities = (weather.items || []).filter(w => w.windspeed > 50);
    const roughSeas = (marine.items || []).filter(b => b.waveHeight > 3);
    if (windyCities.length > 0 && roughSeas.length > 0) {
      return { type: 'correlation', category: 'weather-marine', severity: 3,
        confidence: 0.75, summary: `${windyCities.length} cities with high wind + ${roughSeas.length} stations with rough seas`,
        recommended_action: 'Issue coastal warning' };
    }
    return null;
  }

  earthquakeTsunami(eq, marine) {
    const bigQuakes = (eq.items || []).filter(e => e.magnitude >= 6.5 && e.depth < 70);
    if (bigQuakes.length > 0) {
      return { type: 'correlation', category: 'earthquake-tsunami', severity: 5,
        confidence: 0.6, summary: `Shallow M${bigQuakes[0].magnitude}+ earthquake - tsunami risk`,
        recommended_action: 'Check tsunami buoy readings immediately' };
    }
    return null;
  }
}

module.exports = CorrelationEngine;
