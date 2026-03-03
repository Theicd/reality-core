const https = require('https');
function t(name, url) {
  return new Promise(resolve => {
    https.get(url, { timeout: 8000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ name, status: res.statusCode, size: d.length, cors: res.headers['access-control-allow-origin'] || 'NONE', preview: d.substring(0, 80) }));
    }).on('error', e => resolve({ name, status: 'ERR', error: e.code }))
      .on('timeout', function() { this.destroy(); resolve({ name, status: 'TIMEOUT' }); });
  });
}
async function main() {
  const results = await Promise.all([
    t('USGS Earthquake', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'),
    t('Weather 6pts', 'https://api.open-meteo.com/v1/forecast?latitude=32.08,31.77,32.79,29.56,31.95,30.04&longitude=34.78,35.21,34.99,34.95,35.93,31.24&current_weather=true'),
    t('Marine 4pts', 'https://marine-api.open-meteo.com/v1/marine?latitude=32,33,29.5,35&longitude=34.2,34,34.9,18&current=wave_height,wave_period'),
    t('NOAA SpaceWx', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'),
    t('NOAA SolarWind', 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json'),
  ]);
  results.forEach(r => {
    const ok = r.status === 200 ? '\x1b[32mOK\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`${ok} ${r.name}: ${r.status} | CORS: ${r.cors} | ${r.size || 0}B`);
    if (r.error) console.log(`  Error: ${r.error}`);
    if (r.preview && r.status === 200) console.log(`  ${r.preview}...`);
  });
}
main();
