const https = require('https');

function fetchJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout, headers: { 'Origin': 'https://theicd.github.io' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'], data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
  });
}

function _parseRedAlertResponse(text) {
  if (!text || text.trim().length < 3) return { active: false };
  try {
    const d = JSON.parse(text);
    if (Array.isArray(d)) {
      if (!d.length) return { active: false };
      const first = d[0];
      const areas = first.cities || first.data
        ? (first.cities || (typeof first.data === 'string' ? first.data.split(',').map(s => s.trim()) : first.data))
        : (first.areas || []);
      if (areas.length) return { active: true, id: first.notificationId || first.id || `pub-${Date.now()}`, areas, desc: first.title || first.desc || '', category: first.cat || first.threat || 1, source: 'tzevaadom', timestamp: new Date().toISOString() };
    } else if (d && typeof d === 'object') {
      if (d.data || d.cities) {
        const areas = d.cities || (typeof d.data === 'string' ? d.data.split(',').map(s => s.trim()) : (d.data || []));
        if (areas.length) return { active: true, id: d.id || `pub-${Date.now()}`, areas, desc: d.title || '', category: d.cat || d.threat || 1, source: 'tzevaadom', timestamp: new Date().toISOString() };
      }
    }
  } catch(_) {}
  return { active: false };
}

async function main() {
  console.log('=== FULL FLOW TEST: Red Alert via allorigins + tzevaadom ===\n');

  // Step 1: Fetch via allorigins
  const tzeva = 'https://api.tzevaadom.co.il/notifications';
  const enc = encodeURIComponent(tzeva);
  const url = `https://api.allorigins.win/get?url=${enc}`;
  
  console.log('1. Fetching:', url.substring(0, 80) + '...');
  const res = await fetchJson(url);
  console.log(`   HTTP ${res.status} | CORS: ${res.cors || 'NONE'}`);
  console.log(`   Raw response (first 200 chars): ${res.data.substring(0, 200)}`);

  // Step 2: Extract contents from allorigins wrapper
  let alertText = '';
  try {
    const wrapper = JSON.parse(res.data);
    alertText = wrapper.contents || '';
    console.log(`\n2. Extracted contents: "${alertText}"`);
  } catch(e) {
    console.log(`\n2. Failed to parse wrapper: ${e.message}`);
  }

  // Step 3: Parse red alert response
  const result = _parseRedAlertResponse(alertText);
  console.log(`\n3. Parsed result:`, JSON.stringify(result, null, 2));

  // Step 4: Simulate handleIsraelAlerts decision
  if (result) {
    if (result.active) {
      console.log(`\n4. ✅ ACTIVE ALERT! Areas: ${result.areas.join(', ')}`);
      console.log(`   Description: ${result.desc}`);
      console.log(`   → handleIsraelAlerts would show red alert on map`);
    } else {
      console.log(`\n4. ℹ️ No active alerts. handleIsraelAlerts(active:false) called.`);
      console.log(`   → UI will show "אין התרעות פעילות כרגע"`);
    }
  } else {
    console.log(`\n4. ⚠️ result is null/falsy - handleIsraelAlerts NOT called`);
  }

  // Step 5: Test with simulated active alert data
  console.log('\n\n=== SIMULATED ACTIVE ALERT TEST ===\n');
  const mockTzeva = JSON.stringify([{
    notificationId: "test-123",
    time: Date.now(),
    cities: ["תל אביב - מרכז העיר", "חולון", "בת ים"],
    threat: 1,
    title: "ירי רקטות וטילים",
    isDrill: false
  }]);
  console.log('Mock tzevaadom data:', mockTzeva);
  const mockResult = _parseRedAlertResponse(mockTzeva);
  console.log('Parsed:', JSON.stringify(mockResult, null, 2));
  console.log(mockResult.active ? '✅ Parser correctly identifies active alert' : '❌ Parser FAILED to identify active alert');

  // Step 6: Test "safe to exit" data
  console.log('\n\n=== SIMULATED CLEAR/SAFE TEST ===\n');
  const mockEmpty = '[]';
  const emptyResult = _parseRedAlertResponse(mockEmpty);
  console.log(`Empty response "${mockEmpty}" → active: ${emptyResult.active}`);
  console.log(emptyResult.active === false ? '✅ Correctly identifies no alerts' : '❌ Wrong result');

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(e => console.error('Test failed:', e));
