const https = require('https');

function fetchUrl(url, timeout = 10000, followRedirect = true) {
  return new Promise((resolve) => {
    const start = Date.now();
    const opts = { timeout, headers: { 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://theicd.github.io' } };
    const req = https.get(url, opts, (res) => {
      if (followRedirect && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = new URL(url).origin + loc;
        return fetchUrl(loc, timeout, true).then(resolve);
      }
      let data = '';
      res.on('data', chunk => data += chunk.toString());
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          cors: res.headers['access-control-allow-origin'] || 'NONE',
          size: data.length,
          ms: Date.now() - start,
          data: data.substring(0, 200).replace(/\n/g, ' '),
          ok: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });
    req.on('error', (err) => resolve({ status: 'ERR', error: err.code, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', ok: false }); });
  });
}

function log(label, r) {
  const icon = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const cors = r.cors !== 'NONE' ? `\x1b[32m${r.cors}\x1b[0m` : '\x1b[31mNO CORS\x1b[0m';
  console.log(`${icon} ${label} => ${r.status} | CORS: ${cors} | ${r.size}B | ${r.ms}ms`);
  if (r.data && r.ok) console.log(`  ${r.data.substring(0, 100)}`);
  if (r.error) console.log(`  Error: ${r.error}`);
}

async function main() {
  const oref = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
  const tzeva = 'https://api.tzevaadom.co.il/notifications';
  const celestrak = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';
  const celestrakVisual = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';

  console.log('=== PHASE 2: DEEP PROXY TESTS ===\n');

  console.log('--- codetabs with redirect follow ---');
  log('codetabs oref (follow)', await fetchUrl(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(oref)}`));
  log('codetabs tzeva (follow)', await fetchUrl(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(tzeva)}`));
  log('codetabs celestrak-stations (follow)', await fetchUrl(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(celestrak)}`));
  
  console.log('\n--- codetabs with /? format ---');
  log('codetabs/? oref', await fetchUrl(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(oref)}`));
  log('codetabs/? tzeva', await fetchUrl(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(tzeva)}`));
  log('codetabs/? celestrak-stations', await fetchUrl(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(celestrak)}`));

  console.log('\n--- allorigins with tzeva (PROVEN) ---');
  log('allorigins/get tzeva', await fetchUrl(`https://api.allorigins.win/get?url=${encodeURIComponent(tzeva)}`));
  
  console.log('\n--- allorigins celestrak stations (smaller) ---');
  log('allorigins/get celestrak-stations', await fetchUrl(`https://api.allorigins.win/get?url=${encodeURIComponent(celestrak)}`));

  console.log('\n--- Marine API variations ---');
  log('marine 18pts', await fetchUrl('https://marine-api.open-meteo.com/v1/marine?latitude=32,33,29.5,35,36,34,41,25,24,12,40,35,25,55,10,-35,0,-10&longitude=34.2,34,34.9,18,28,25,29,37,55,45,-30,140,-90,-5,80,150,-25,50&current=wave_height,wave_period'));
  log('marine 6pts', await fetchUrl('https://marine-api.open-meteo.com/v1/marine?latitude=32,33,29.5,35,41,25&longitude=34.2,34,34.9,18,29,55&current=wave_height,wave_period'));
  
  console.log('\n--- Direct celestrak (stations = small set) ---');
  const celDirect = await fetchUrl(celestrak);
  log('celestrak stations direct', celDirect);
  if (celDirect.ok) console.log(`  Total lines ~${celDirect.data.split('\\n').length}`);

  console.log('\n=== SUMMARY ===');
  console.log('Best red alert path: allorigins/get + tzevaadom');
  console.log('Best marine path: open-meteo marine API (direct CORS)');
  console.log('Best satellite path: test above');
}

main().catch(console.error);
