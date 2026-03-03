require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  wsPort: parseInt(process.env.WS_PORT) || 3001,
  logLevel: process.env.LOG_LEVEL || 'info',
  refreshInterval: parseInt(process.env.DATA_REFRESH_INTERVAL) || 60000,
  aiInterval: parseInt(process.env.AI_ANALYSIS_INTERVAL) || 30000,
  apis: {
    usgs: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0', interval: 60000 },
    openMeteo: { url: 'https://api.open-meteo.com/v1', interval: 300000 },
    openSky: { url: 'https://opensky-network.org/api', interval: 60000 },
    noaaSpace: { url: 'https://services.swpc.noaa.gov/products', interval: 60000 },
    noaaBuoys: { url: 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt', interval: 300000 },
    celestrak: { url: 'https://celestrak.org/NORAD/elements/gp.php', interval: 600000 },
    shipAIS: { url: 'https://meri.digitraffic.fi/api/ais/v1/locations', interval: 30000 },
    redAlertIL: { url: 'https://www.oref.org.il/warningMessages/alert', interval: 3000 },
    iss: { url: 'http://api.open-notify.org/iss-now.json', interval: 10000 },
    solarSystem: { url: 'https://api.le-systeme-solaire.net/rest/bodies', interval: 3600000 }
  }
};
