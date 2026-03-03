const BaseConnector = require('./BaseConnector');
const config = require('../config');

class OpenMeteoConnector extends BaseConnector {
  constructor() {
    super('OpenMeteo', config.apis.openMeteo);
    this.cities = [
      { name: 'Tel Aviv', lat: 32.08, lon: 34.78 },
      { name: 'New York', lat: 40.71, lon: -74.01 },
      { name: 'London', lat: 51.51, lon: -0.13 },
      { name: 'Tokyo', lat: 35.68, lon: 139.69 },
      { name: 'Sydney', lat: -33.87, lon: 151.21 },
      { name: 'Moscow', lat: 55.75, lon: 37.62 },
      { name: 'Cairo', lat: 30.04, lon: 31.24 },
      { name: 'São Paulo', lat: -23.55, lon: -46.63 },
      { name: 'Mumbai', lat: 19.08, lon: 72.88 },
      { name: 'Beijing', lat: 39.90, lon: 116.40 }
    ];
  }

  async poll() {
    const results = [];
    for (const city of this.cities) {
      try {
        const data = await this.fetch('/forecast', {
          latitude: city.lat, longitude: city.lon,
          current_weather: true,
          hourly: 'temperature_2m,windspeed_10m,winddirection_10m,pressure_msl,cloudcover,rain,direct_radiation'
        });
        const cw = data.current_weather;
        results.push({
          city: city.name,
          geo: { lat: city.lat, lon: city.lon },
          temperature: cw.temperature,
          windspeed: cw.windspeed,
          winddirection: cw.winddirection,
          weathercode: cw.weathercode,
          hourly: {
            temperature: data.hourly?.temperature_2m?.slice(0, 24),
            wind: data.hourly?.windspeed_10m?.slice(0, 24),
            pressure: data.hourly?.pressure_msl?.slice(0, 24),
            clouds: data.hourly?.cloudcover?.slice(0, 24),
            rain: data.hourly?.rain?.slice(0, 24),
            radiation: data.hourly?.direct_radiation?.slice(0, 24)
          }
        });
      } catch (e) { /* skip city on error */ }
    }
    this.publish('weather', { items: results, count: results.length });
    return results;
  }
}

module.exports = OpenMeteoConnector;
