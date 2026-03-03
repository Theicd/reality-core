// REALITY CORE - Local Analysis Engine (no backend AI needed)
// Generates smart insights from live data, displayed in the AI panel
(function() {
  'use strict';

  const ICONS = { SEISMIC:'⚠', TSUNAMI:'🌊', WEATHER:'🌡', MARITIME:'🌊', SPACE:'☄', AVIATION:'✈', SHIPS:'⛴', ISS:'🛰', RED_ALERT:'🚨', SUMMARY:'📊', CORRELATION:'🔗' };
  const SEV_COLORS = { 5:'#ff1744', 4:'#ff1744', 3:'#ff9100', 2:'#ffd600', 1:'#00e5ff' };

  let _lastRun = 0;
  let _insights = [];
  const _seen = new Set();

  function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }

  function runLocalAnalysis(live, opts = {}) {
    const now = Date.now();
    if (now - _lastRun < (opts.interval || 20000)) return _insights;
    _lastRun = now;

    const results = [];

    analyzeEarthquakes(live, results, now);
    analyzeWeather(live, results, now);
    analyzeMarine(live, results, now);
    analyzeSpaceWeather(live, results, now);
    analyzeTraffic(live, results, now);
    analyzeSatellites(live, results, now);
    generateSummary(live, results, now);

    if (results.length) {
      _insights = [...results, ..._insights].slice(0, 50);
    }
    if (_seen.size > 300) { const arr = [..._seen]; _seen.clear(); arr.slice(-100).forEach(k => _seen.add(k)); }

    return _insights;
  }

  function analyzeEarthquakes(live, results, now) {
    const items = live.earthquake?.items;
    if (!Array.isArray(items) || !items.length) return;

    const sorted = [...items].sort((a, b) => (n(b.magnitude) || 0) - (n(a.magnitude) || 0));
    const top = sorted[0];
    const mag = n(top?.magnitude) || 0;

    // דיווח על כל רעידה מעל 3.0
    sorted.filter(eq => (n(eq.magnitude) || 0) >= 3.0).slice(0, 5).forEach(eq => {
      const m = n(eq.magnitude) || 0;
      const key = `eq-${eq.id || eq.place}-${m.toFixed(1)}`;
      if (_seen.has(key)) return;
      _seen.add(key);

      const depth = n(eq.depth) || 0;
      const tsunamiRisk = m >= 6.3 && depth < 70;
      const sev = tsunamiRisk ? 5 : m >= 6 ? 4 : m >= 5 ? 3 : m >= 4 ? 2 : 1;

      let summary = `רעידת אדמה ${m.toFixed(1)} ריכטר`;
      if (eq.place) summary += ` ב${eq.place}`;
      summary += ` | עומק: ${depth || '?'} km`;

      let action = '';
      if (tsunamiRisk) action = '⚠ סיכון צונאמי! בדוק אזהרות לחופים';
      else if (m >= 5) action = 'עקוב אחרי רעידות המשך. בדוק נזק מבני באזור';
      else if (m >= 4) action = 'מורגש באזור. עקוב אחרי עדכונים';
      else action = 'רעידה קלה. ללא סיכון מיידי';

      results.push({ id: key, category: tsunamiRisk ? 'TSUNAMI' : 'SEISMIC', severity: sev, summary, recommended_action: action, geo: eq.geo, timestamp: eq.time || new Date().toISOString() });
    });

    // ריכוז רעידות באזור
    if (sorted.length >= 3) {
      const last24h = sorted.filter(eq => eq.time && (now - new Date(eq.time).getTime()) < 86400000);
      if (last24h.length >= 3) {
        const key = `eq-cluster-${last24h.length}-${Math.floor(now / 300000)}`;
        if (!_seen.has(key)) {
          _seen.add(key);
          results.push({ id: key, category: 'SEISMIC', severity: 2, summary: `${last24h.length} רעידות אדמה ב-24 שעות האחרונות. החזקה ביותר: ${mag.toFixed(1)} ריכטר`, recommended_action: 'ריכוז רעידות עלול להצביע על פעילות סייסמית מוגברת', timestamp: new Date().toISOString() });
        }
      }
    }
  }

  function analyzeWeather(live, results, now) {
    const items = live.weather?.items;
    if (!Array.isArray(items) || !items.length) return;

    // חום/קור קיצוני
    items.forEach(w => {
      const temp = n(w.temperature);
      const wind = n(w.windspeed) || 0;
      if (temp === null) return;

      if (temp > 40 || temp < -5 || wind > 70) {
        const key = `wx-${w.city || ''}-${Math.floor(now / 300000)}`;
        if (_seen.has(key)) return;
        _seen.add(key);

        const sev = temp > 45 ? 4 : temp > 40 ? 3 : temp < -10 ? 4 : temp < -5 ? 3 : wind > 90 ? 4 : 3;
        let summary = `מזג אוויר קיצוני ב${w.city || '?'}: `;
        if (temp > 40) summary += `חום כבד ${Math.round(temp)}°C`;
        else if (temp < -5) summary += `קור עז ${Math.round(temp)}°C`;
        if (wind > 70) summary += ` | רוחות ${Math.round(wind)} km/h`;

        results.push({ id: key, category: 'WEATHER', severity: sev, summary, recommended_action: temp > 40 ? 'הישאר בצל, שתה הרבה מים' : temp < -5 ? 'הישאר חם, הימנע מנסיעות' : 'היזהר ברוחות חזקות', geo: w.geo, timestamp: new Date().toISOString() });
      }
    });

    // סיכום מזג אוויר אזורי
    const temps = items.filter(w => n(w.temperature) !== null).map(w => n(w.temperature));
    if (temps.length >= 3) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const max = Math.max(...temps);
      const min = Math.min(...temps);
      const key = `wx-summary-${Math.floor(now / 600000)}`;
      if (!_seen.has(key)) {
        _seen.add(key);
        results.push({ id: key, category: 'WEATHER', severity: 1, summary: `סיכום מזג אוויר: ממוצע ${Math.round(avg)}°C | טווח ${Math.round(min)}° עד ${Math.round(max)}° | ${temps.length} תחנות`, recommended_action: max > 35 ? 'טמפרטורות גבוהות צפויות' : min < 5 ? 'טמפרטורות נמוכות צפויות' : 'מזג אוויר נוח', timestamp: new Date().toISOString() });
      }
    }
  }

  function analyzeMarine(live, results, now) {
    const items = live.marine?.items;
    if (!Array.isArray(items) || !items.length) return;

    const waves = items.filter(b => (n(b.waveHeight) || 0) > 0).sort((a, b) => (n(b.waveHeight) || 0) - (n(a.waveHeight) || 0));
    if (!waves.length) return;

    const maxWave = n(waves[0].waveHeight) || 0;
    const highWaves = waves.filter(b => (n(b.waveHeight) || 0) > 2);

    const key = `marine-${highWaves.length}-${maxWave.toFixed(0)}-${Math.floor(now / 300000)}`;
    if (_seen.has(key)) return;
    _seen.add(key);

    const sev = maxWave > 6 ? 4 : maxWave > 4 ? 3 : maxWave > 2 ? 2 : 1;
    let summary = `מצב ימי: גל מקסימלי ${maxWave.toFixed(1)}m`;
    if (highWaves.length) summary += ` | ${highWaves.length} תחנות עם גלים >2m`;
    summary += ` | ${waves.length} תחנות פעילות`;

    let action = '';
    if (maxWave > 4) action = '⚠ ים סוער! הימנע מפעילות ימית';
    else if (maxWave > 2) action = 'ים גלי. זהירות בשייט קטן';
    else action = 'ים רגוע יחסית';

    results.push({ id: key, category: 'MARITIME', severity: sev, summary, recommended_action: action, timestamp: new Date().toISOString() });
  }

  function analyzeSpaceWeather(live, results, now) {
    const sw = live.space_weather;
    if (!sw) return;

    const kp = n(sw.kpIndex) || 0;
    const key = `space-${kp.toFixed(0)}-${Math.floor(now / 600000)}`;
    if (_seen.has(key)) return;
    _seen.add(key);

    if (kp >= 4) {
      const sev = kp >= 7 ? 5 : kp >= 5 ? 4 : 3;
      results.push({ id: key, category: 'SPACE', severity: sev, summary: `סופה גיאומגנטית KP ${kp.toFixed(1)} - ${kp >= 7 ? 'חזקה מאוד' : kp >= 5 ? 'בינונית' : 'קלה'}. עלול להשפיע על תקשורת ו-GPS`, recommended_action: kp >= 5 ? 'בדוק מערכות תקשורת ו-GPS. סכנה ללוויינים' : 'מעקב רציף', timestamp: new Date().toISOString() });
    }
  }

  function analyzeTraffic(live, results, now) {
    const planes = live.aviation?.items;
    const ships = live.ships?.items;

    if (Array.isArray(planes) && planes.length >= 5) {
      const key = `aviation-${planes.length}-${Math.floor(now / 600000)}`;
      if (!_seen.has(key)) {
        _seen.add(key);
        const countries = [...new Set(planes.map(p => p.country).filter(Boolean))];
        results.push({ id: key, category: 'AVIATION', severity: 1, summary: `${planes.length} מטוסים מזוהים באזור${countries.length ? '. מדינות: ' + countries.slice(0, 5).join(', ') : ''}`, recommended_action: 'מעקב שגרתי', timestamp: new Date().toISOString() });
      }
    }

    if (Array.isArray(ships) && ships.length >= 3) {
      const key = `ships-${ships.length}-${Math.floor(now / 600000)}`;
      if (!_seen.has(key)) {
        _seen.add(key);
        results.push({ id: key, category: 'SHIPS', severity: 1, summary: `${ships.length} כלי שיט מזוהים באזור`, recommended_action: 'מעקב שגרתי', timestamp: new Date().toISOString() });
      }
    }
  }

  function analyzeSatellites(live, results, now) {
    const sats = live.satellites?.items;
    if (!Array.isArray(sats) || !sats.length) return;

    const iss = live.iss;
    const key = `sat-${sats.length}-${Math.floor(now / 600000)}`;
    if (_seen.has(key)) return;
    _seen.add(key);

    let summary = `${sats.length} לוויינים במעקב`;
    if (iss?.geo) summary += ` | ISS: ${iss.geo.lat?.toFixed(1)}°, ${iss.geo.lon?.toFixed(1)}°`;
    results.push({ id: key, category: 'ISS', severity: 1, summary, recommended_action: 'מעקב שגרתי', timestamp: new Date().toISOString() });
  }

  function generateSummary(live, results, now) {
    const key = `summary-${Math.floor(now / 600000)}`;
    if (_seen.has(key)) return;
    _seen.add(key);

    const parts = [];
    const eqItems = live.earthquake?.items;
    if (Array.isArray(eqItems) && eqItems.length) {
      const maxMag = Math.max(...eqItems.map(e => n(e.magnitude) || 0));
      parts.push(`${eqItems.length} רעידות (max ${maxMag.toFixed(1)}R)`);
    }
    if (live.weather?.items?.length) parts.push(`${live.weather.items.length} תחנות מזג אוויר`);
    if (live.marine?.items?.length) parts.push(`${live.marine.items.length} מצופים ימיים`);
    if (live.satellites?.items?.length) parts.push(`${live.satellites.items.length} לוויינים`);
    if (live.aviation?.items?.length) parts.push(`${live.aviation.items.length} מטוסים`);
    if (live.ships?.items?.length) parts.push(`${live.ships.items.length} אוניות`);

    if (parts.length) {
      results.push({ id: key, category: 'SUMMARY', severity: 1, summary: `סיכום מערכת: ${parts.join(' | ')}`, recommended_action: `עדכון: ${new Date().toLocaleTimeString()}`, timestamp: new Date().toISOString() });
    }
  }

  // Feed insights into the AI panel system
  function feedToAiPanel(pushAiAlertFn) {
    if (!pushAiAlertFn) return;
    _insights.forEach(item => {
      pushAiAlertFn({
        id: item.id,
        category: `${ICONS[item.category] || '📊'} ${item.category}`,
        severity: item.severity,
        summary: item.summary,
        recommended_action: item.recommended_action,
        geo: item.geo || null,
        timestamp: item.timestamp
      });
    });
  }

  // Expose globally
  window.localAnalysis = { run: runLocalAnalysis, feed: feedToAiPanel, getInsights: () => _insights };
})();
