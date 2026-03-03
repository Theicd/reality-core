const https = require('https');
const http = require('http');

function fetchWithHeaders(url, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://theicd.github.io', 'Referer': 'https://theicd.github.io/' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk.toString());
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          cors: res.headers['access-control-allow-origin'] || 'NONE',
          size: data.length,
          ms: Date.now() - start,
          preview: data.substring(0, 120).replace(/\n/g, ' '),
          ok: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });
    req.on('error', (err) => resolve({ status: 'ERR', error: err.code || err.message, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', ok: false }); });
  });
}

async function test(label, url) {
  const r = await fetchWithHeaders(url);
  const icon = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const corsOk = r.cors && r.cors !== 'NONE' ? `\x1b[32m${r.cors}\x1b[0m` : `\x1b[31mNONE\x1b[0m`;
  console.log(`${icon} ${label}`);
  console.log(`  HTTP ${r.status} | CORS: ${corsOk} | ${r.size || 0}B | ${r.ms || 0}ms`);
  if (r.error) console.log(`  Error: ${r.error}`);
  if (r.preview && r.ok) console.log(`  Data: ${r.preview.substring(0, 80)}...`);
  console.log();
  return r;
}

async function main() {
  const oref = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
  const tzeva = 'https://api.tzevaadom.co.il/notifications';
  const celestrak = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';
  const enc_oref = encodeURIComponent(oref);
  const enc_tzeva = encodeURIComponent(tzeva);
  const enc_cel = encodeURIComponent(celestrak);

  console.log('========================================');
  console.log('  CORS PROXY TEST SUITE');
  console.log('  Origin: https://theicd.github.io');
  console.log('========================================\n');

  console.log('--- DIRECT APIs (should have CORS) ---\n');
  await test('USGS Earthquake', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
  await test('Open-Meteo Weather', 'https://api.open-meteo.com/v1/forecast?latitude=32.08&longitude=34.78&current_weather=true');
  await test('Open-Meteo Marine (2 pts)', 'https://marine-api.open-meteo.com/v1/marine?latitude=32,33&longitude=34.2,34&current=wave_height,wave_period');
  await test('Open-Meteo Marine (1 pt)', 'https://marine-api.open-meteo.com/v1/marine?latitude=32&longitude=34.2&current=wave_height');
  await test('ISS Where', 'https://api.wheretheiss.at/v1/satellites/25544');

  console.log('\n--- RED ALERT: DIRECT ---\n');
  await test('oref.org.il DIRECT', oref);
  await test('tzevaadom DIRECT', tzeva);

  console.log('\n--- PROXY: allorigins.win ---\n');
  await test('allorigins /get oref', `https://api.allorigins.win/get?url=${enc_oref}`);
  await test('allorigins /raw oref', `https://api.allorigins.win/raw?url=${enc_oref}`);
  await test('allorigins /get tzeva', `https://api.allorigins.win/get?url=${enc_tzeva}`);
  await test('allorigins /get celestrak', `https://api.allorigins.win/get?url=${enc_cel}`);

  console.log('\n--- PROXY: corsproxy.io ---\n');
  await test('corsproxy oref', `https://corsproxy.io/?${enc_oref}`);
  await test('corsproxy tzeva', `https://corsproxy.io/?${enc_tzeva}`);
  await test('corsproxy celestrak', `https://corsproxy.io/?${enc_cel}`);

  console.log('\n--- PROXY: codetabs.com ---\n');
  await test('codetabs oref', `https://api.codetabs.com/v1/proxy?quest=${enc_oref}`);
  await test('codetabs tzeva', `https://api.codetabs.com/v1/proxy?quest=${enc_tzeva}`);
  await test('codetabs celestrak', `https://api.codetabs.com/v1/proxy?quest=${enc_cel}`);

  console.log('\n--- PROXY: thingproxy ---\n');
  await test('thingproxy oref', `https://thingproxy.freeboard.io/fetch/${oref}`);

  console.log('\n--- PROXY: cors-anywhere alternatives ---\n');
  await test('jsonp.afeld.me oref', `https://jsonp.afeld.me/?url=${enc_oref}`);
  await test('yacdn proxy oref', `https://yacdn.org/proxy/${oref}`);
  await test('cors.sh oref', `https://proxy.cors.sh/${oref}`);
  await test('corsproxy.org oref', `https://corsproxy.org/?${enc_oref}`);

  console.log('\n--- ALTERNATIVE RED ALERT SOURCES ---\n');
  await test('oref WarningMessages (Heb)', 'https://www.oref.org.il/WarningMessages/alert/Ede.json');
  await test('oref History API', 'https://www.oref.org.il/WarningMessages/alert/History/AlertsHistory.json');

  console.log('\n========================================');
  console.log('  TEST COMPLETE');
  console.log('========================================');
}

main().catch(console.error);
