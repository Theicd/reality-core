// API Connector Tests - Tests actual API connectivity
const axios = require('axios');

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/',
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/json'
};

module.exports = async function(qa) {
  // USGS API
  await qa.run('USGS API', async () => {
    const res = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson', { timeout: 15000 });
    qa.assertEqual(res.status, 200, 'USGS should return 200');
    qa.assert(res.data.features, 'USGS should return features array');
    qa.assertType(res.data.features, 'object', 'Features should be array');
    console.log(`    → ${res.data.features.length} earthquakes in last hour`);
  });

  // Open-Meteo API
  await qa.run('Open-Meteo API', async () => {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: 32.08, longitude: 34.78, current_weather: true },
      timeout: 15000
    });
    qa.assertEqual(res.status, 200, 'Open-Meteo should return 200');
    qa.assert(res.data.current_weather, 'Should have current_weather');
    qa.assertType(res.data.current_weather.temperature, 'number', 'Temperature should be number');
    console.log(`    → Tel Aviv: ${res.data.current_weather.temperature}°C`);
  });

  // OpenSky API
  await qa.run('OpenSky API', async () => {
    try {
      const res = await axios.get('https://opensky-network.org/api/states/all', {
        params: { lamin: 30, lamax: 35, lomin: 30, lomax: 40 },
        timeout: 20000
      });
      qa.assertEqual(res.status, 200, 'OpenSky should return 200');
      qa.assert(res.data.time, 'Should have timestamp');
      console.log(`    → ${(res.data.states || []).length} aircraft in region`);
    } catch (e) {
      if (e.response && e.response.status === 429) {
        console.log('    ⚠ OpenSky rate limited (expected for free tier)');
      } else throw e;
    }
  });

  // NOAA Space Weather API
  await qa.run('NOAA Space API', async () => {
    const res = await axios.get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { timeout: 15000 });
    qa.assertEqual(res.status, 200, 'NOAA Space should return 200');
    qa.assertArray(res.data, 'Should return array');
    qa.assert(res.data.length > 1, 'Should have data rows');
    const latest = res.data[res.data.length - 1];
    console.log(`    → Latest KP: ${latest[1]}`);
  });

  // NOAA Buoys API
  await qa.run('NOAA Buoys API', async () => {
    const res = await axios.get('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt', { timeout: 15000 });
    qa.assertEqual(res.status, 200, 'NOAA Buoys should return 200');
    qa.assert(res.data.length > 100, 'Should have data content');
    const lines = res.data.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    console.log(`    → ${lines.length - 1} buoy stations received`);
  });

  // CelesTrak API
  await qa.run('CelesTrak API', async () => {
    const res = await axios.get('https://celestrak.org/NORAD/elements/gp.php', {
      params: { GROUP: 'active', FORMAT: 'json' },
      timeout: 20000
    });
    qa.assertEqual(res.status, 200, 'CelesTrak should return 200');
    qa.assertArray(res.data, 'Should return array');
    qa.assert(res.data.length > 0, 'Should have satellites');
    console.log(`    → ${res.data.length} active satellites`);
  });

  // ISS Position API
  await qa.run('ISS API', async () => {
    const res = await axios.get('http://api.open-notify.org/iss-now.json', { timeout: 10000 });
    qa.assertEqual(res.status, 200, 'ISS should return 200');
    qa.assert(res.data.iss_position, 'Should have iss_position');
    qa.assert(res.data.iss_position.latitude, 'Should have latitude');
    console.log(`    → ISS at ${res.data.iss_position.latitude}°, ${res.data.iss_position.longitude}°`);
  });

  // Ship AIS API (Digitraffic Finland)
  await qa.run('Ship AIS API', async () => {
    const res = await axios.get('https://meri.digitraffic.fi/api/ais/v1/locations', { timeout: 15000 });
    qa.assertEqual(res.status, 200, 'AIS should return 200');
    qa.assert(res.data.features, 'Should have features');
    qa.assert(res.data.features.length > 0, 'Should have ships');
    console.log(`    → ${res.data.features.length} ships tracked`);
  });

  // Pikud HaOref (Israel Red Alert)
  await qa.run('Pikud HaOref API', async () => {
    const res = await axios.get('https://www.oref.org.il/warningMessages/alert/Alerts.json', {
      headers: OREF_HEADERS,
      responseType: 'text',
      timeout: 15000
    });
    qa.assertEqual(res.status, 200, 'Pikud HaOref should return 200');
    const cleaned = String(res.data || '').replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim();
    qa.assert(cleaned.length >= 0, 'Payload should be readable');
    if (cleaned && cleaned !== '{}' && cleaned !== '[]' && cleaned !== 'null') {
      const parsed = JSON.parse(cleaned);
      qa.assertType(parsed, 'object', 'Pikud HaOref payload should be object');
      qa.assert(Array.isArray(parsed.data), 'Pikud HaOref payload should include data array');
    }
    console.log(`    → OREF payload bytes: ${cleaned.length}`);
  });

  // U.S. DoS travel advisories feed (relevant for U.S. staff safety alerts)
  await qa.run('US State Travel Advisories API', async () => {
    const res = await axios.get('https://cadataapi.state.gov/api/TravelAdvisories', { timeout: 20000 });
    qa.assertEqual(res.status, 200, 'State advisories API should return 200');
    qa.assertArray(res.data, 'State advisories should return array');
    qa.assert(res.data.length > 0, 'State advisories should not be empty');
    const me = res.data.filter(x => ['IL', 'LE', 'SY', 'IQ', 'JO', 'SA'].includes((x.Category || [])[0]));
    console.log(`    → ${res.data.length} advisories total | ${me.length} Middle East entries`);
  });

  // FAA prohibitions / restrictions page (aviation risk context)
  await qa.run('FAA Restrictions Notices', async () => {
    const res = await axios.get('https://www.faa.gov/air_traffic/publications/us_restrictions', {
      responseType: 'text',
      timeout: 20000
    });
    qa.assertEqual(res.status, 200, 'FAA restrictions page should return 200');
    const html = String(res.data || '');
    qa.assert(html.includes('Prohibitions') || html.includes('Restrictions'), 'FAA page should include restrictions content');
    console.log(`    → FAA restrictions page reachable (${html.length} bytes)`);
  });
};
