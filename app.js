// REALITY CORE V3 - Command Center
const API = 'http://localhost:3000/api';
let ws = null, cesiumViewer = null, data = {}, eventLog = [];
const ARC_LEN = 157;
const layerVisible = { satellite:true, satOrbit:true, aviation:true, ships:true, earthquake:true, weather:true, marine:true, iss:true, alertZone:true, israel_alerts:true };
let mapMode = 'flat';
let alertReturnTimer = null;
let uiLang = localStorage.getItem('rc_ui_lang') || 'he';

const I18N = {
  he: {
    doc_title: 'REALITY CORE - מרכז שליטה גלובלי',
    lang_he: 'עברית', lang_en: 'EN',
    logo_sub: 'מרכז שליטה גלובלי',
    title_ai: 'ניתוח AI', title_events: 'אירועים חיים', title_moon: 'ירח',
    kp_index: 'מדד KP', solar_wind: 'רוח שמש', unit_wind: 'קמ/ש',
    seismic: 'סייסמי', unit_seismic: 'מגניטודה מקס',
    waves: 'גלים', unit_waves: 'מטר מקס',
    stat_aircraft: 'מטוסים', stat_ships: 'אוניות', stat_quakes: 'רעידות',
    stat_sats: 'לוויינים', stat_iss: 'ISS', stat_buoys: 'מצופים',
    quake_scale: 'סולם ריכטר',
    layer_sat: 'לוויינים', layer_orbits: 'מסלולים', layer_alerts: 'התראות', layer_il_red: 'צבע אדום',
    layer_flat: 'מפה שטוחה', layer_globe: 'גלובוס', layer_air: 'אוויר', layer_sea: 'ים',
    layer_quake: 'רעידות', layer_wx: 'מזג אוויר', layer_wave: 'גלים', layer_iss: 'ISS',
    ship_live: 'חי', ship_regional: 'אזורי', ship_stale: 'ישן', ship_off: 'כבוי',
    tag_breaking: 'דחוף', tag_alert: 'התראה', tag_update: 'עדכון',
    alert_detected: 'זוהתה התראה', click_to_focus: 'לחץ למיקוד', iss_position: 'מיקום ISS',
    evt_seismic: 'סייסמי', evt_weather: 'מזג אוויר', evt_aircraft: 'מטוסים', evt_vessels: 'אוניות',
    evt_il_red: 'צבע אדום', evt_iss: 'ISS', evt_space: 'חלל', evt_marine: 'ימי', evt_sats: 'לוויינים',
    ai_seismic: 'סייסמי', ai_space: 'מזג חלל', ai_weather: 'מזג אוויר', ai_aviation: 'תעופה',
    ai_marine: 'ימי', ai_ships: 'אוניות', ai_iss: 'ISS', ai_correlation: 'קורלציה',
    ai_lvl: 'רמה', ai_wait: 'ממתין לנתוני ניתוח...', ai_collect: 'אוסף זרמי נתונים...',
    ai_standby: 'מנוע אנליזה בהמתנה', ai_init: 'מאתחל מנוע ניתוח...',
    alert_prefix: 'התראה', system: 'מערכת', status_on: 'פועל', status_off: 'כבוי',
    unknown: 'לא ידוע',
    popup_richter: 'ריכטר', popup_depth: 'עומק', popup_tsunami: 'סיכון צונאמי', popup_time: 'זמן', popup_latlon: 'קו רוחב/אורך',
    popup_guide: 'מדריך ריכטר: 4.0+ מורגש | 5.0+ סיכון מבני | 6.5+ פוטנציאל צונאמי אם רדוד.',
    popup_alert_lvl: 'רמת התראה', popup_confidence: 'ביטחון', popup_ack: 'אישור',
    sev_extreme: 'קיצוני', sev_major: 'חמור מאוד', sev_strong: 'חזק', sev_moderate: 'בינוני', sev_light: 'קל', sev_minor: 'מינורי',
    tsu_high: 'גבוה', tsu_medium: 'בינוני', tsu_low: 'נמוך',
    txt_quake_news: 'רעידת אדמה M{mag}: {place} | עומק: {depth} ק"מ',
    txt_tsunami_watch: 'אזהרת צונאמי: רעידה M{mag} רדודה ליד {place}',
    txt_critical_seismic: 'אירוע סייסמי קריטי: M{mag} באזור {place}',
    txt_extreme_weather: 'מזג אוויר קיצוני: {city} - {temp}°C, רוח: {wind} קמ"ש',
    txt_geomagnetic: 'התראת סערה גיאומגנטית: KP {kp} - פגיעה אפשרית בלוויינים',
    txt_maritime_warning: '{count} תחנות מדווחות על גלים מעל 5 מטר - אזהרה ימית',
    txt_israel_red_default: 'צבע אדום בישראל: {areas}',
    globe_loading: 'טוען מפה...'
  },
  en: {
    doc_title: 'REALITY CORE - Global Command',
    lang_he: 'HE', lang_en: 'EN',
    logo_sub: 'GLOBAL COMMAND CENTER',
    title_ai: 'AI ANALYSIS', title_events: 'LIVE EVENTS', title_moon: 'MOON',
    kp_index: 'KP INDEX', solar_wind: 'SOLAR WIND', unit_wind: 'km/s',
    seismic: 'SEISMIC', unit_seismic: 'max mag',
    waves: 'WAVES', unit_waves: 'm max',
    stat_aircraft: 'AIRCRAFT', stat_ships: 'SHIPS', stat_quakes: 'QUAKES',
    stat_sats: 'SATS', stat_iss: 'ISS', stat_buoys: 'BUOYS',
    quake_scale: 'RICHTER SCALE',
    layer_sat: 'SAT', layer_orbits: 'ORBITS', layer_alerts: 'ALERTS', layer_il_red: 'IL RED',
    layer_flat: 'FLAT', layer_globe: 'GLOBE', layer_air: 'AIR', layer_sea: 'SEA',
    layer_quake: 'QUAKE', layer_wx: 'WX', layer_wave: 'WAVE', layer_iss: 'ISS',
    ship_live: 'LIVE', ship_regional: 'REGIONAL', ship_stale: 'STALE', ship_off: 'OFF',
    tag_breaking: 'BREAKING', tag_alert: 'ALERT', tag_update: 'UPDATE',
    alert_detected: 'Alert detected', click_to_focus: 'Click to focus', iss_position: 'ISS Position',
    evt_seismic: 'SEISMIC', evt_weather: 'WEATHER', evt_aircraft: 'AIRCRAFT', evt_vessels: 'VESSELS',
    evt_il_red: 'RED ALERT IL', evt_iss: 'ISS', evt_space: 'SPACE WX', evt_marine: 'MARITIME', evt_sats: 'SATS',
    ai_seismic: 'SEISMIC', ai_space: 'SPACE WEATHER', ai_weather: 'WEATHER', ai_aviation: 'AIR TRAFFIC',
    ai_marine: 'MARITIME', ai_ships: 'VESSELS', ai_iss: 'ISS', ai_correlation: 'CORRELATION',
    ai_lvl: 'LVL', ai_wait: 'Awaiting analysis data...', ai_collect: 'Collecting data streams...',
    ai_standby: 'Neural engine standby', ai_init: 'INITIALIZING NEURAL ENGINE...',
    alert_prefix: 'ALERT', system: 'SYSTEM', status_on: 'ON', status_off: 'OFF',
    unknown: 'Unknown',
    popup_richter: 'RICHTER', popup_depth: 'Depth', popup_tsunami: 'Tsunami Risk', popup_time: 'Time', popup_latlon: 'Lat/Lon',
    popup_guide: 'Richter guide: 4.0+ noticeable | 5.0+ structural risk | 6.5+ potential tsunami if shallow.',
    popup_alert_lvl: 'ALERT LVL', popup_confidence: 'Confidence', popup_ack: 'ACKNOWLEDGE',
    sev_extreme: 'EXTREME', sev_major: 'MAJOR', sev_strong: 'STRONG', sev_moderate: 'MODERATE', sev_light: 'LIGHT', sev_minor: 'MINOR',
    tsu_high: 'HIGH', tsu_medium: 'MEDIUM', tsu_low: 'LOW',
    txt_quake_news: 'M{mag} earthquake detected: {place} | Depth: {depth}km',
    txt_tsunami_watch: 'TSUNAMI WATCH: M{mag} shallow quake near {place}',
    txt_critical_seismic: 'CRITICAL SEISMIC EVENT: M{mag} at {place}',
    txt_extreme_weather: 'Extreme weather: {city} - {temp}°C, Wind: {wind}km/h',
    txt_geomagnetic: 'Geomagnetic storm alert: KP Index {kp} - satellite disruption possible',
    txt_maritime_warning: '{count} stations reporting waves > 5m - maritime warning',
    txt_israel_red_default: 'ISRAEL RED ALERT: {areas}',
    globe_loading: 'GLOBE LOADING...'
  }
};

function tr(key, vars = {}) {
  let txt = (I18N[uiLang] && I18N[uiLang][key]) || I18N.en[key] || key;
  Object.entries(vars).forEach(([k, v]) => { txt = txt.replaceAll(`{${k}}`, String(v)); });
  return txt;
}

function setText(id, key) {
  const el = document.getElementById(id);
  if (el) el.textContent = tr(key);
}

function setUILanguage(lang) {
  uiLang = lang === 'en' ? 'en' : 'he';
  localStorage.setItem('rc_ui_lang', uiLang);
  renderLanguageSwitch();
  applyLanguage();
}

function renderLanguageSwitch() {
  const sw = document.getElementById('lang-switch');
  if (!sw) return;
  sw.innerHTML = `<button class="${uiLang === 'he' ? 'active' : ''}" onclick="setUILanguage('he')">${tr('lang_he')}</button><button class="${uiLang === 'en' ? 'active' : ''}" onclick="setUILanguage('en')">${tr('lang_en')}</button>`;
}

function setMapModeButtonText() {
  const btn = document.getElementById('map-mode-btn');
  if (!btn) return;
  if (mapMode === 'flat') {
    btn.textContent = `◉ ${tr('layer_globe')}`;
    btn.classList.add('active');
    btn.style.setProperty('--lc', '#00e5ff');
  } else {
    btn.textContent = `▭ ${tr('layer_flat')}`;
    btn.classList.remove('active');
    btn.style.setProperty('--lc', '#9fb3d1');
  }
}

function setLayerToggleTexts() {
  const labels = {
    satellite: `◈ ${tr('layer_sat')}`,
    satOrbit: `⊙ ${tr('layer_orbits')}`,
    alertZone: `⚑ ${tr('layer_alerts')}`,
    israel_alerts: `✹ ${tr('layer_il_red')}`,
    aviation: `▲ ${tr('layer_air')}`,
    ships: `▼ ${tr('layer_sea')}`,
    earthquake: `★ ${tr('layer_quake')}`,
    weather: `● ${tr('layer_wx')}`,
    marine: `≈ ${tr('layer_wave')}`,
    iss: `◉ ${tr('layer_iss')}`
  };
  Object.entries(labels).forEach(([layer, text]) => {
    const btn = document.querySelector(`.layer-btn[data-layer="${layer}"]`);
    if (btn) btn.textContent = text;
  });
  setMapModeButtonText();
}

function applyLanguage() {
  document.documentElement.lang = uiLang;
  document.title = tr('doc_title');
  setText('logo-subtitle', 'logo_sub');
  setText('title-ai-analysis', 'title_ai');
  setText('title-live-events', 'title_events');
  setText('label-moon', 'title_moon');
  setText('label-kp-index', 'kp_index');
  setText('label-solar-wind', 'solar_wind');
  setText('unit-wind', 'unit_wind');
  setText('label-seismic', 'seismic');
  setText('unit-seismic', 'unit_seismic');
  setText('label-waves', 'waves');
  setText('unit-waves', 'unit_waves');
  setText('label-stat-aircraft', 'stat_aircraft');
  setText('label-stat-ships', 'stat_ships');
  setText('label-stat-quakes', 'stat_quakes');
  setText('label-stat-sats', 'stat_sats');
  setText('label-stat-iss', 'stat_iss');
  setText('label-stat-buoys', 'stat_buoys');
  setText('quake-scale-label', 'quake_scale');
  const initEl = document.querySelector('#ai-insight-content .ai-typing');
  if (initEl) initEl.textContent = tr('ai_init');
  setLayerToggleTexts();
  refreshShipSourceBadge();
  renderEventFeed();
}

function refreshShipSourceBadge() {
  const el = document.getElementById('stat-ships-src');
  if (!el) return;
  if (el.classList.contains('live')) el.textContent = tr('ship_live');
  else if (el.classList.contains('warn')) el.textContent = tr('ship_regional');
  else if (el.classList.contains('stale')) el.textContent = tr('ship_stale');
  else if (el.classList.contains('off')) el.textContent = tr('ship_off');
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  renderLanguageSwitch();
  applyLanguage();
  initClock(); initWebSocket(); initCesium(); fetchLoop(); fetchAIInsights(); initUIZoom();
  setTimeout(initEntityClick, 2000);
  document.addEventListener('click', () => window.soundSystem?.init(), { once: true });
});

// ==================== CLOCK ====================
function initClock() {
  setInterval(() => {
    const t = new Date().toISOString().replace('T',' ').slice(0,19) + ' UTC';
    const el = document.getElementById('clock'); if (el) el.textContent = t;
    const el2 = document.getElementById('bottom-clock'); if (el2) el2.textContent = t;
  }, 1000);
}

// ==================== WEBSOCKET ====================
function initWebSocket() {
  try {
    ws = new WebSocket(`ws://${location.hostname}:${location.port || 3000}/ws`);
    ws.onopen = () => setConnStatus(true);
    ws.onclose = () => { setConnStatus(false); setTimeout(initWebSocket, 3000); };
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        if (ev.type === 'welcome') return;
        data[ev.type] = ev.data;
        updateUI(ev.type, ev.data);
        if (ev.type === 'alert') handleAlert(ev.data);
        addEventLog(ev.type);
      } catch(e) {}
    };
  } catch(e) { setTimeout(initWebSocket, 3000); }
}
function setConnStatus(ok) { const el = document.getElementById('conn-status'); if(el) el.className = 'status-dot ' + (ok ? 'green' : 'red'); }

// ==================== FETCH ====================
async function fetchLoop() {
  try {
    const [statusRes, dataRes, alertRes] = await Promise.allSettled([
      fetch(`${API}/status`), fetch(`${API}/data`), fetch(`${API}/alerts`)
    ]);
    if (statusRes.status === 'fulfilled') { const s = await statusRes.value.json(); renderConnectorStatuses(s.connectors); renderAIStatus(s.ai); }
    if (dataRes.status === 'fulfilled') { const all = await dataRes.value.json(); Object.entries(all).forEach(([t, d]) => { data[t] = d; updateUI(t, d); }); }
    if (alertRes.status === 'fulfilled') { renderAlerts(await alertRes.value.json()); }
  } catch(e) {}
  setTimeout(fetchLoop, 8000);
}

// ==================== CESIUM (CartoDB Dark - English labels) ====================
function initCesium() {
  try {
    Cesium.Ion.defaultAccessToken = undefined;
    cesiumViewer = new Cesium.Viewer('cesiumContainer', {
      baseLayerPicker:false, geocoder:false, homeButton:false,
      sceneModePicker:false, navigationHelpButton:false, animation:false,
      timeline:false, fullscreenButton:false, vrButton:false,
      infoBox:false, selectionIndicator:false,
      skyBox:false, skyAtmosphere: new Cesium.SkyAtmosphere(),
      scene3DOnly:true, imageryProvider: false
    });
    // CartoDB Dark Matter - ALWAYS English labels, dark sci-fi theme
    cesiumViewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url:'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      maximumLevel:18, credit:'CartoDB'
    }));
    const scene = cesiumViewer.scene;
    scene.backgroundColor = Cesium.Color.fromCssColorString('#030810');
    scene.globe.enableLighting = false;
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1628');
    scene.fog.enabled = true; scene.fog.density = 2e-4;
    scene.globe.showGroundAtmosphere = true;
    // Real moon with NASA texture at correct distance
    if (scene.moon) {
      scene.moon.show = true;
      scene.moon.textureUrl = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2048.jpg';
    }
    if (scene.sun) scene.sun.show = true;
    setMapModeButtonText();
    scene.morphTo2D(0);
    setTimeout(() => setGlobalCamera('flat'), 80);
  } catch(e) {
    console.error('Cesium init error:', e);
    document.getElementById('cesiumContainer').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#00e5ff;font-family:Orbitron;font-size:18px">${tr('globe_loading')}</div>`;
  }
}

function focusIsraelView() {
  if (!cesiumViewer) return;
  if (mapMode === 'flat') {
    cesiumViewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(31.2, 29.1, 36.9, 33.9),
      duration: 1.8,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  } else {
    cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(34.9, 31.5, 1300000),
      duration: 1.8,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  }
}

function flyToAlertAndReturn(alert) {
  if (!cesiumViewer || !alert?.geo) return;
  const targetAlt = (alert.severity || 1) >= 4 ? 900000 : 1300000;
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(alert.geo.lon, alert.geo.lat, targetAlt),
    duration: 2.0,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
  });
  if (alertReturnTimer) clearTimeout(alertReturnTimer);
  alertReturnTimer = setTimeout(() => focusIsraelView(), 5500);
}

function setGlobalCamera(mode = mapMode) {
  if (!cesiumViewer) return;
  if (mode === 'flat') {
    cesiumViewer.camera.setView({
      destination: Cesium.Rectangle.fromDegrees(-180, -70, 180, 82)
    });
  } else {
    cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(12, 18, 22000000),
      duration: 1.2
    });
  }
}

function toggleMapMode() {
  if (!cesiumViewer) return;
  if (mapMode === 'globe') {
    mapMode = 'flat';
    cesiumViewer.scene.morphTo2D(0.9);
    setTimeout(() => setGlobalCamera('flat'), 950);
  } else {
    mapMode = 'globe';
    cesiumViewer.scene.morphTo3D(0.9);
    setTimeout(() => setGlobalCamera('globe'), 1100);
  }
  setMapModeButtonText();
}

// ==================== LAYER TOGGLE ====================
function toggleLayer(type) {
  layerVisible[type] = !layerVisible[type];
  const btn = document.querySelector(`.layer-btn[data-layer="${type}"]`);
  if (btn) btn.classList.toggle('active', layerVisible[type]);
  if (!cesiumViewer) return;
  cesiumViewer.entities.values.forEach(e => { if (e._rcType === type) e.show = layerVisible[type]; });
  // If orbit layer is turned on after being cleared, rebuild from current satellite data
  if (type === 'satOrbit' && layerVisible.satOrbit && data.satellites?.items?.length) {
    addSatellites(data.satellites.items);
  }
}

// ==================== SVG ICON GENERATOR (real shapes, not emoji) ====================
const _iconCache = {};
const SVG_SHAPES = {
  aircraft: (c) => `<path d="M24 8 L26 18 L38 22 L26 24 L28 36 L24 32 L20 36 L22 24 L10 22 L22 18 Z" fill="${c}" stroke="#000" stroke-width="1"/>`,
  ship: (c) => `<path d="M12 30 L16 18 L20 14 L20 10 L22 10 L22 14 L24 14 L24 10 L26 10 L26 14 L28 14 L28 18 L36 30 Z" fill="${c}" stroke="#000" stroke-width="1"/><path d="M10 32 L38 32 L36 38 L12 38 Z" fill="${c}" opacity="0.7"/>`,
  satellite: (c) => `<rect x="18" y="10" width="12" height="8" rx="1" fill="${c}" stroke="#000" stroke-width="1"/><rect x="6" y="12" width="12" height="4" fill="${c}" opacity="0.7"/><rect x="30" y="12" width="12" height="4" fill="${c}" opacity="0.7"/><circle cx="24" cy="24" r="3" fill="${c}"/><line x1="24" y1="18" x2="24" y2="21" stroke="${c}" stroke-width="2"/><line x1="20" y1="28" x2="18" y2="34" stroke="${c}" stroke-width="1.5"/><line x1="28" y1="28" x2="30" y2="34" stroke="${c}" stroke-width="1.5"/>`,
  quake: (c) => `<polygon points="24,4 28,16 40,16 30,24 34,36 24,28 14,36 18,24 8,16 20,16" fill="${c}" stroke="#000" stroke-width="1"/>`,
  wave: (c) => `<path d="M6 24 Q12 16 18 24 Q24 32 30 24 Q36 16 42 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M6 30 Q12 22 18 30 Q24 38 30 30 Q36 22 42 30" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>`,
  alert: (c) => `<polygon points="24,6 42,38 6,38" fill="none" stroke="${c}" stroke-width="2.5"/><text x="24" y="32" text-anchor="middle" fill="${c}" font-size="18" font-weight="bold">!</text>`,
  iss: (c) => `<rect x="10" y="20" width="28" height="8" rx="3" fill="${c}" stroke="#000" stroke-width="1"/><rect x="4" y="16" width="8" height="16" rx="1" fill="${c}" opacity="0.6"/><rect x="36" y="16" width="8" height="16" rx="1" fill="${c}" opacity="0.6"/><circle cx="24" cy="24" r="4" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
};

function makeSvgIcon(type, size, color) {
  const key = `svgv3_${type}_${size}_${color}`;
  if (_iconCache[key]) return _iconCache[key];
  const s = size * 2;
  const shape = SVG_SHAPES[type] || SVG_SHAPES.alert;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 48 48">
    <defs>
      <filter id="g"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>
    <g filter="url(#g)" opacity="0.45">${shape(color)}</g>
    <g>${shape(color)}</g>
  </svg>`;
  // Return SVG directly so Cesium renders the real shape immediately (no async canvas race)
  _iconCache[key] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return _iconCache[key];
}

function validGeo(geo) {
  return Number.isFinite(geo?.lat) && Number.isFinite(geo?.lon);
}

// Earthquake richter frame icon
function makeQuakeIcon(magnitude) {
  const s = 96;
  const c = document.createElement('canvas'); c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  const sevCol = magnitude >= 6 ? '#ff0033' : magnitude >= 4 ? '#ff6600' : magnitude >= 2.5 ? '#ff9900' : '#ffcc00';
  // Outer pulsing ring
  ctx.shadowColor = sevCol; ctx.shadowBlur = 16;
  ctx.strokeStyle = sevCol; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(s/2, s/2, s/2-6, 0, Math.PI*2); ctx.stroke();
  // Inner filled circle
  ctx.shadowBlur = 0;
  ctx.fillStyle = sevCol + '40';
  ctx.beginPath(); ctx.arc(s/2, s/2, s/2-12, 0, Math.PI*2); ctx.fill();
  // Magnitude number - BIG and clear
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${magnitude >= 5 ? 36 : 30}px Orbitron, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(magnitude.toFixed(1), s/2, s/2);
  // Corner brackets for frame effect
  ctx.strokeStyle = sevCol; ctx.lineWidth = 2;
  const b = 8, e = s-8;
  ctx.beginPath(); ctx.moveTo(b,b+12); ctx.lineTo(b,b); ctx.lineTo(b+12,b); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e-12,b); ctx.lineTo(e,b); ctx.lineTo(e,b+12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e,e-12); ctx.lineTo(e,e); ctx.lineTo(e-12,e); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b+12,e); ctx.lineTo(b,e); ctx.lineTo(b,e-12); ctx.stroke();
  return c.toDataURL();
}
function clearType(type) {
  if (!cesiumViewer) return;
  const rem = []; cesiumViewer.entities.values.forEach(e => { if (e._rcType === type) rem.push(e); });
  rem.forEach(e => cesiumViewer.entities.remove(e));
}

// ==================== SATELLITES - SVG icon + separate orbit toggle ====================
function addSatellites(items) {
  if (!cesiumViewer || !items?.length) return;
  clearType('satellite'); clearType('satOrbit');
  if (!layerVisible.satellite) return;
  const icon = makeSvgIcon('satellite', 28, '#4fc3f7');
  items.slice(0, 30).forEach((sat, i) => {
    const inc = parseFloat(sat.inclination) || 45;
    const mm = parseFloat(sat.meanMotion) || 14;
    const alt = Math.max(200000, Math.min(Math.pow(8681663.653/mm,2/3)*1000-6371000, 36000000));
    const raan = (i*47)%360, startA = (i*73)%360;
    const iR = inc*Math.PI/180, rR = raan*Math.PI/180, aR = startA*Math.PI/180;
    const lat = Math.asin(Math.sin(iR)*Math.sin(aR))*180/Math.PI;
    const lon = (Math.atan2(Math.sin(aR)*Math.cos(iR),Math.cos(aR))+rR)*180/Math.PI;
    const e = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon%360-180, lat, alt),
      billboard: { image: icon, width: 40, height: 40 },
      label: { text: sat.name||'', font: 'bold 15px Rajdhani',
        fillColor: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(24, 0),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000000) }
    });
    e._rcType = 'satellite'; e._rcData = sat;
    // Orbit path - SEPARATE type for independent toggle
    if (layerVisible.satOrbit) {
      const pts = [];
      for (let a=0; a<=360; a+=5) {
        const ar = a*Math.PI/180;
        pts.push(Cesium.Cartesian3.fromDegrees(
          (Math.atan2(Math.sin(ar)*Math.cos(iR),Math.cos(ar))+rR)*180/Math.PI%360-180,
          Math.asin(Math.sin(iR)*Math.sin(ar))*180/Math.PI, alt));
      }
      const orb = cesiumViewer.entities.add({
        polyline: { positions: pts, width: 1.5,
          material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.15, color: Cesium.Color.CYAN.withAlpha(0.3) }) }
      });
      orb._rcType = 'satOrbit';
    }
  });
}

// ==================== AIRCRAFT - SVG plane icon + yellow trails ====================
function addAircraft(items) {
  if (!cesiumViewer) return;
  clearType('aviation');
  if (!items?.length || !layerVisible.aviation) return;
  const icon = makeSvgIcon('aircraft', 28, '#ffd600');
  items.slice(0, 100).forEach(ac => {
    if (!validGeo(ac.geo)) return;
    const alt = ac.altitude || 10000;
    const e = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(ac.geo.lon, ac.geo.lat, alt),
      billboard: { image: icon, width: 44, height: 44,
        rotation: ac.heading ? -Cesium.Math.toRadians(ac.heading) : 0 },
      label: { text: `${ac.callsign||''} ${ac.country||''}`, font: 'bold 14px Rajdhani',
        fillColor: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(26, 0),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000) }
    });
    e._rcType = 'aviation'; e._rcData = ac;
    if (ac.heading !== undefined) {
      const hdg = (ac.heading||0)*Math.PI/180;
      const t = cesiumViewer.entities.add({
        polyline: { positions: [
          Cesium.Cartesian3.fromDegrees(ac.geo.lon-Math.sin(hdg)*3, ac.geo.lat-Math.cos(hdg)*3, alt),
          Cesium.Cartesian3.fromDegrees(ac.geo.lon, ac.geo.lat, alt)
        ], width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.25, color: Cesium.Color.YELLOW.withAlpha(0.45) }) }
      });
      t._rcType = 'aviation';
    }
  });
}

// ==================== WEATHER ====================
function addWeather(items) {
  if (!cesiumViewer) return;
  clearType('weather');
  if (!items?.length || !layerVisible.weather) return;
  items.forEach(w => {
    if (!validGeo(w.geo)) return;
    const t = w.temperature;
    const col = t > 35 ? '#ff1744' : t > 25 ? '#ff9100' : t > 15 ? '#ffd600' : t > 5 ? '#00e5ff' : '#2196f3';
    const e = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(w.geo.lon, w.geo.lat, 0),
      point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
      label: { text: `${w.city} ${t}°C`, font: 'bold 14px Rajdhani',
        fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(12, 0),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        showBackground: true, backgroundColor: Cesium.Color.fromCssColorString(col).withAlpha(0.3) }
    });
    e._rcType = 'weather'; e._rcData = w;
  });
}

// ==================== EARTHQUAKES - RICHTER FRAME (magnitude number visible!) ====================
function addEarthquakes(items) {
  if (!cesiumViewer) return;
  clearType('earthquake');
  if (!items?.length || !layerVisible.earthquake) return;
  items.forEach(eq => {
    if (!validGeo(eq.geo)) return;
    const mag = eq.magnitude || 0;
    const icon = makeQuakeIcon(mag);
    const sevCol = mag >= 6 ? '#ff0033' : mag >= 4 ? '#ff6600' : mag >= 2.5 ? '#ff9900' : '#ffcc00';
    const ringR = Math.max(50000, mag * 80000);
    const iconSize = Math.max(48, Math.min(80, mag * 12));
    const e = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(eq.geo.lon, eq.geo.lat, 0),
      billboard: { image: icon, width: iconSize, height: iconSize },
      label: { text: `${tr('popup_richter')} ${mag.toFixed(2)}\n${eq.place||tr('unknown')}`,
        font: 'bold 14px Rajdhani',
        fillColor: Cesium.Color.fromCssColorString(sevCol), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(iconSize/2+8, 0),
        showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#111').withAlpha(0.9) }
    });
    e._rcType = 'earthquake'; e._rcData = eq;
    // Concentric danger rings
    for (let r = 1; r <= 3; r++) {
      const ring = cesiumViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(eq.geo.lon, eq.geo.lat, 0),
        ellipse: { semiMajorAxis: ringR * r, semiMinorAxis: ringR * r,
          material: Cesium.Color.TRANSPARENT,
          outline: true, outlineColor: Cesium.Color.fromCssColorString(sevCol).withAlpha(0.5 / r), outlineWidth: 2 }
      });
      ring._rcType = 'earthquake';
      ring._rcData = eq;
    }
  });
}

// ==================== SHIPS - SVG ship icon, size by type ====================
function addShips(items) {
  if (!cesiumViewer) return;
  clearType('ships');
  if (!items?.length || !layerVisible.ships) return;
  const iconSmall = makeSvgIcon('ship', 18, '#00bfa5');
  const iconMed = makeSvgIcon('ship', 24, '#00e5ff');
  const iconLarge = makeSvgIcon('ship', 30, '#26c6da');
  items.slice(0, 150).forEach(s => {
    if (!validGeo(s.geo)) return;
    const st = s.shipType || 0;
    const isBig = st >= 70 && st <= 79;
    const isMed = st >= 60 && st <= 69;
    const icon = isBig ? iconLarge : isMed ? iconMed : iconSmall;
    const sz = isBig ? 36 : isMed ? 28 : 22;
    const e = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(s.geo.lon, s.geo.lat, 0),
      billboard: { image: icon, width: sz, height: sz,
        rotation: s.heading ? -Cesium.Math.toRadians(s.heading) : 0 },
      label: { text: s.name||'', font: `bold ${isBig?14:12}px Rajdhani`,
        fillColor: Cesium.Color.fromCssColorString('#00bfa5'), outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(sz/2+6, 0),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isBig ? 3000000 : 1500000) }
    });
    e._rcType = 'ships'; e._rcData = s;
  });
}

// ==================== MARINE BUOYS - graphical wave height bars ====================
function addMarineBuoys(items) {
  if (!cesiumViewer) return;
  clearType('marine');
  if (!items?.length || !layerVisible.marine) return;
  items.forEach(b => {
    if (!validGeo(b.geo)) return;
    const wh = parseFloat(b.waveHeight) || 0;
    const col = wh > 4 ? '#ff1744' : wh > 2 ? '#ff9100' : '#00bcd4';
    // Wave height bar icon
    const icon = makeWaveBar(wh, col);
    const e = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(b.geo.lon, b.geo.lat, 0),
      billboard: { image: icon, width: 40, height: 60, verticalOrigin: Cesium.VerticalOrigin.BOTTOM },
      label: { text: `${wh.toFixed(1)}m | ${b.waterTemp||'?'}°C`, font: 'bold 13px Rajdhani',
        fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(24, -30),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4000000) }
    });
    e._rcType = 'marine'; e._rcData = b;
  });
}

// Graphical wave height bar
function makeWaveBar(height, color) {
  const key = `wave_${height}_${color}`;
  if (_iconCache[key]) return _iconCache[key];
  const w = 40, h = 80;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const barH = Math.min(70, Math.max(8, height * 10));
  // Bar background
  ctx.fillStyle = '#111';
  ctx.fillRect(8, h-barH-4, w-16, barH);
  // Filled bar
  const grad = ctx.createLinearGradient(0, h, 0, h-barH);
  grad.addColorStop(0, color); grad.addColorStop(1, color + '60');
  ctx.fillStyle = grad;
  ctx.fillRect(10, h-barH-2, w-20, barH-2);
  // Border
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.strokeRect(8, h-barH-4, w-16, barH);
  // Height text on top
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(height.toFixed(1)+'m', w/2, h-barH-10);
  _iconCache[key] = c.toDataURL();
  return _iconCache[key];
}

// ==================== ISS - SVG icon ====================
function addISS(d) {
  if (!cesiumViewer || !d?.geo) return;
  clearType('iss');
  if (!layerVisible.iss) return;
  const icon = makeSvgIcon('iss', 34, '#7c4dff');
  const e = cesiumViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(d.geo.lon, d.geo.lat, 408000),
    billboard: { image: icon, width: 52, height: 52 },
    label: { text: `ISS ${d.geo.lat.toFixed(1)}° ${d.geo.lon.toFixed(1)}°`, font: 'bold 16px Rajdhani',
      fillColor: Cesium.Color.fromCssColorString('#b388ff'), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(30, 0),
      showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#1a0033').withAlpha(0.8) }
  });
  e._rcType = 'iss'; e._rcData = d;
}

// ==================== UPDATE UI ====================
function updateUI(type, d) {
  switch(type) {
    case 'earthquake': updateGauges(d); addEarthquakes(d.items); checkNewQuakes(d); break;
    case 'weather': addWeather(d.items); break;
    case 'aviation': updateStats(d); addAircraft(d.items); break;
    case 'israel_alerts':
      if (!d?.active) { clearType('israel_alerts'); break; }
      handleIsraelAlerts(d);
      break;
    case 'space_weather': updateGauges(d); break;
    case 'marine': updateGauges(d); addMarineBuoys(d.items); updateExtraStats('marine', d); break;
    case 'ships': updateStats(d); addShips(d.items); break;
    case 'iss': updateISS(d); addISS(d); break;
    case 'satellites': addSatellites(d.items); updateExtraStats('satellites', d); break;
    case 'solar_system': updateMoon(d); break;
  }
  detectAnomalies();
}

// ==================== GAUGES ====================
function setArc(id, value, max) { const el = document.getElementById(id); if(!el) return; el.style.strokeDashoffset = ARC_LEN * (1 - Math.min(1, Math.max(0, value/max))); }
function setVal(id, text) { const el = document.getElementById(id); if(el) el.textContent = text; }

function updateGauges(d) {
  if (d.kpIndex !== undefined) { setArc('arc-kp', d.kpIndex, 9); setVal('val-kp', d.kpIndex.toFixed(1)); }
  if (d.solarWindSpeed !== undefined) { setArc('arc-wind', d.solarWindSpeed, 800); setVal('val-wind', Math.round(d.solarWindSpeed)); }
  if (d.items?.[0]?.magnitude !== undefined) {
    const m = Math.max(...d.items.map(e => e.magnitude||0));
    setArc('arc-quake', m, 9); setVal('val-quake', m.toFixed(1)); setVal('stat-quakes', d.count||d.items.length);
  }
  if (d.items?.[0]?.waveHeight !== undefined) {
    const w = Math.max(...d.items.map(b => parseFloat(b.waveHeight)||0));
    setArc('arc-wave', w, 15); setVal('val-wave', w.toFixed(1));
  }
}
function updateStats(d) {
  if (d.count !== undefined && d.items?.[0]?.callsign !== undefined) setVal('stat-aircraft', d.count);
  const isShipsPayload = d.items?.[0]?.mmsi !== undefined || ['live', 'stale-cache', 'empty'].includes(d.source);
  if (d.count !== undefined && isShipsPayload) {
    setVal('stat-ships', d.count);
    setShipSourceBadge(d);
  }
}
function setShipSourceBadge(d) {
  const el = document.getElementById('stat-ships-src');
  if (!el) return;
  if (d.source === 'live' && d.coverage?.limited) {
    el.textContent = tr('ship_regional');
    el.className = 'stat-src warn';
    return;
  }
  if (d.source === 'live') { el.textContent = tr('ship_live'); el.className = 'stat-src live'; return; }
  if (d.source === 'stale-cache') { el.textContent = tr('ship_stale'); el.className = 'stat-src stale'; return; }
  el.textContent = tr('ship_off');
  el.className = 'stat-src off';
}
function updateExtraStats(type, d) {
  if (type === 'satellites' && d.count) setVal('stat-sats', d.count);
  if (type === 'marine' && d.count) setVal('stat-buoys', d.count);
}
function updateISS(d) { if (d.geo) setVal('stat-iss', `${d.geo.lat.toFixed(1)}°, ${d.geo.lon.toFixed(1)}°`); }

// ==================== EARTHQUAKE CINEMATIC HUD + AUTO FOCUS ====================
let lastQuakeIds = new Set();
function checkNewQuakes(d) {
  if (!d.items?.length) return;
  // Sort by magnitude descending - focus on biggest first
  const sorted = [...d.items].sort((a,b) => (Number(b.magnitude||0)) - (Number(a.magnitude||0)));
  sorted.filter(eq => Number(eq.magnitude || 0) >= 2.0).forEach(eq => {
    const mag = Number(eq.magnitude || 0);
    const id = eq.id || `${mag}-${eq.time}`;
    if (lastQuakeIds.has(id)) return;
    lastQuakeIds.add(id);
    // Auto-generate news alert for significant quakes
    if (mag >= 3.0) {
      addNewsAlert({
        severity: mag >= 6 ? 5 : mag >= 4.5 ? 4 : 3,
        summary: tr('txt_quake_news', { mag: mag.toFixed(2), place: eq.place || tr('unknown'), depth: eq.depth || '?' }),
        geo: eq.geo, category: 'SEISMIC'
      });
    }
  });
  if (lastQuakeIds.size > 200) lastQuakeIds = new Set([...lastQuakeIds].slice(-100));
}
function showQuakeHUD(eq) {
  return;
  const magVal = Number(eq.magnitude || 0);
  const hud = document.getElementById('quake-hud'); if (!hud) return;
  setVal('quake-mag', magVal.toFixed(2));
  setVal('quake-location', eq.place || 'Unknown Location');
  setVal('quake-depth', `DEPTH: ${eq.depth||'?'} KM | ${new Date(eq.time).toLocaleTimeString()}`);
  const bar = document.getElementById('quake-bar-fill');
  if (bar) bar.style.width = Math.min(100, (magVal/9)*100) + '%';
  const mag = document.getElementById('quake-mag');
  if (mag) { mag.style.color = magVal >= 6 ? '#ff0044' : magVal >= 4 ? '#ff4400' : '#ff9100'; }
  hud.classList.remove('hidden'); hud.classList.add('active');
  const flash = document.getElementById('alert-flash');
  if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 800); }
  if (magVal >= 4) window.soundSystem?.alertCritical(); else window.soundSystem?.alertInfo();
  // Auto-fly to earthquake zone
  if (eq.geo && cesiumViewer) {
    const alt = magVal >= 6 ? 500000 : magVal >= 4 ? 800000 : 2000000;
    cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(eq.geo.lon, eq.geo.lat, alt),
      duration: 2.5, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  }
  setTimeout(() => { hud.classList.remove('active'); hud.classList.add('hidden'); }, magVal >= 5 ? 10000 : 6000);
}

// ==================== AUTO ANOMALY DETECTION & FOCUS ====================
let lastAnomalyCheck = 0;
const seenAnomalies = new Set();

function addUniqueAnomalyAlert(key, alert) {
  if (seenAnomalies.has(key)) return;
  seenAnomalies.add(key);
  if (seenAnomalies.size > 300) seenAnomalies.clear();
  addNewsAlert(alert);
}

function detectAnomalies() {
  const now = Date.now();
  if (now - lastAnomalyCheck < 30000) return;
  lastAnomalyCheck = now;
  // Earthquake / tsunami risk
  if (data.earthquake?.items?.length) {
    const critical = data.earthquake.items.filter(eq => (eq.magnitude || 0) >= 6.0);
    critical.forEach(eq => {
      const key = `eq-${eq.id || `${eq.magnitude}-${eq.time}`}`;
      const tsunamiRisk = (eq.magnitude || 0) >= 6.5 && (eq.depth || 999) < 70;
      addUniqueAnomalyAlert(key, {
        severity: tsunamiRisk ? 5 : 4,
        summary: tsunamiRisk
          ? tr('txt_tsunami_watch', { mag: (eq.magnitude || 0).toFixed(2), place: eq.place || tr('unknown') })
          : tr('txt_critical_seismic', { mag: (eq.magnitude || 0).toFixed(2), place: eq.place || tr('unknown') }),
        geo: eq.geo,
        category: tsunamiRisk ? 'TSUNAMI' : 'SEISMIC'
      });
    });
  }
  // Check for extreme weather
  if (data.weather?.items) {
    const extreme = data.weather.items.filter(w => w.temperature > 42 || w.temperature < -35 || w.windspeed > 80);
    extreme.forEach(w => {
      addUniqueAnomalyAlert(`wx-${w.city}-${w.timestamp || ''}`, { severity: 3, summary: tr('txt_extreme_weather', { city: w.city || tr('unknown'), temp: w.temperature, wind: w.windspeed || 0 }), geo: w.geo, category: 'WEATHER' });
    });
  }
  // Check for high solar activity
  if (data.space_weather?.kpIndex >= 5) {
    addUniqueAnomalyAlert(`space-${data.space_weather.kpIndex}-${Math.floor(now / 120000)}`, { severity: 4, summary: tr('txt_geomagnetic', { kp: data.space_weather.kpIndex }), category: 'SPACE WEATHER' });
  }
  // Check for high waves
  if (data.marine?.items) {
    const bigWaves = data.marine.items.filter(b => parseFloat(b.waveHeight) > 5);
    if (bigWaves.length > 0) {
      addUniqueAnomalyAlert(`wave-${bigWaves.length}-${Math.floor(now / 120000)}`, { severity: 3, summary: tr('txt_maritime_warning', { count: bigWaves.length }), geo: bigWaves[0].geo, category: 'MARITIME' });
    }
  }
}

// ==================== MOON (no solar system) ====================
function updateMoon(d) {
  if (!d.moon) return;
  setVal('moon-phase', d.moon.phaseName);
  setVal('moon-illum', d.moon.illumination + '%');
  drawMoonCanvas(d.moon);
}
function drawMoonCanvas(moon) {
  const c = document.getElementById('moon-canvas'); if (!c) return;
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height, r = w/2-4, cx = w/2, cy = h/2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  const phase = moon.phaseAngle / 360;
  ctx.fillStyle = '#c8c8d0'; ctx.beginPath();
  const sweep = Math.cos(phase*2*Math.PI);
  for (let a = -Math.PI/2; a <= Math.PI/2; a += 0.05) {
    const x = cx + sweep*r*Math.cos(a), y = cy + r*Math.sin(a);
    a === -Math.PI/2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  for (let a = Math.PI/2; a >= -Math.PI/2; a -= 0.05) ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
  ctx.fill();
}

// ==================== ALERT ZONES ON GLOBE ====================
let alertZoneIds = new Set();
function renderAlerts(alerts) {
  if (!alerts?.length) return;
  alerts.forEach(a => {
    addAlertZone(a, a.category === 'ISRAEL RED ALERT' ? 'israel_alerts' : 'alertZone');
    addNewsAlert(a);
  });
}
function addAlertZone(a, layerType = 'alertZone') {
  if (!cesiumViewer || !a.geo) return;
  if (a.id && alertZoneIds.has(a.id)) return;
  if (a.id) alertZoneIds.add(a.id);
  const col = a.severity >= 4 ? '#ff1744' : a.severity >= 3 ? '#ff9100' : '#ffd600';
  const icon = makeSvgIcon('alert', 24, col);
  const e = cesiumViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(a.geo.lon, a.geo.lat, 0),
    billboard: { image: icon, width: 36, height: 36 },
    ellipse: { semiMajorAxis: 250000, semiMinorAxis: 250000,
      material: Cesium.Color.TRANSPARENT,
      outline: true, outlineColor: Cesium.Color.fromCssColorString(col).withAlpha(0.5), outlineWidth: 3 },
    label: { text: `${tr('alert_prefix')}: ${a.category||tr('system')}`, font: 'bold 15px Rajdhani',
      fillColor: Cesium.Color.fromCssColorString(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(22, 0),
      showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.85) }
  });
  e._rcType = layerType; e._rcData = { ...a, _isAlert: true };
}
function handleAlert(alert) {
  if (alert.severity >= 4) window.soundSystem?.alertCritical();
  else if (alert.severity >= 2) window.soundSystem?.alertInfo();
  if (alert.geo) {
    flyToAlertAndReturn(alert);
    addAlertZone(alert, alert.category === 'ISRAEL RED ALERT' ? 'israel_alerts' : 'alertZone');
  }
  addNewsAlert(alert);
}
async function ackAlert(id) { await fetch(`${API}/alerts/${id}/ack`, {method:'POST'}); }

const seenIsraelAlertIds = new Set();
function handleIsraelAlerts(d) {
  if (!d?.active || !d.id || seenIsraelAlertIds.has(d.id)) return;
  seenIsraelAlertIds.add(d.id);
  if (seenIsraelAlertIds.size > 120) seenIsraelAlertIds.clear();

  const areas = Array.isArray(d.areas) ? d.areas : [];
  const preview = areas.slice(0, 4).join(', ');
  const suffix = areas.length > 4 ? ` (+${areas.length - 4} more)` : '';
  const uiAlert = {
    id: `alert-${d.id}`,
    category: 'ISRAEL RED ALERT',
    severity: d.severity || 5,
    summary: d.summary || tr('txt_israel_red_default', { areas: (preview || tr('unknown')) + suffix }),
    geo: d.geo || { lat: 31.7683, lon: 35.2137 }
  };

  addAlertZone(uiAlert, 'israel_alerts');
}

// ==================== NEWS TICKER (breaking news style alerts) ====================
function addNewsAlert(alert) {
  const ticker = document.getElementById('news-ticker');
  if (!ticker) return;
  const col = alert.severity >= 4 ? '#ff1744' : alert.severity >= 3 ? '#ff9100' : '#ffd600';
  const tag = alert.severity >= 4 ? tr('tag_breaking') : alert.severity >= 3 ? tr('tag_alert') : tr('tag_update');
  const item = document.createElement('div');
  item.className = 'news-item';
  item.style.borderLeft = `4px solid ${col}`;
  item.innerHTML = `<span class="news-tag" style="background:${col}">${tag}</span><span class="news-text">${alert.summary||alert.category||tr('alert_detected')}</span><span class="news-time">${new Date().toLocaleTimeString()}</span>`;
  item.onclick = () => {
    if (alert.geo && cesiumViewer) {
      cesiumViewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(alert.geo.lon, alert.geo.lat, 800000), duration: 2 });
    }
  };
  ticker.prepend(item);
  // Keep max 10 items
  while (ticker.children.length > 10) ticker.removeChild(ticker.lastChild);
  // Flash effect
  item.style.animation = 'newsFlash 0.6s ease';
}

// ==================== EVENT LOG (clickable → fly to location) ====================
const EVT_COLORS = { earthquake:'#ff1744', weather:'#00e5ff', aviation:'#ffd600', ships:'#00bfa5', israel_alerts:'#ff1744', iss:'#7c4dff', space_weather:'#ff9100', marine:'#00bcd4', satellites:'#4fc3f7' };
function getEventLabel(type) {
  const m = {
    earthquake: tr('evt_seismic'), weather: tr('evt_weather'), aviation: tr('evt_aircraft'), ships: tr('evt_vessels'),
    israel_alerts: tr('evt_il_red'), iss: tr('evt_iss'), space_weather: tr('evt_space'), marine: tr('evt_marine'), satellites: tr('evt_sats')
  };
  return m[type] || type.toUpperCase();
}

function renderEventFeed() {
  const el = document.getElementById('event-feed');
  if (!el) return;
  el.innerHTML = eventLog.slice(0,20).map((e, i) =>
    `<div class="event-item" onclick="flyToEvent(${i})" style="cursor:pointer" title="${tr('click_to_focus')}"><span class="event-dot" style="background:${e.color};box-shadow:0 0 6px ${e.color}"></span><span style="color:var(--text2);font-size:11px;font-family:Orbitron;min-width:55px">${e.time}</span><span style="color:${e.color};font-weight:700;font-size:13px">${getEventLabel(e.type)}</span><span style="color:var(--text2);font-size:11px;margin-left:4px">${e.detail?e.detail.slice(0,20):''}</span></div>`
  ).join('');
}

function addEventLog(type) {
  const d = data[type];
  let geo = null, detail = '';
  if (d?.items?.[0]?.geo) {
    geo = d.items[0].geo;
    if (type === 'earthquake') detail = `R ${Number(d.items[0].magnitude || 0).toFixed(2)}`;
    else if (type === 'israel_alerts') detail = (d.areas || []).slice(0, 2).join(', ');
    else detail = d.items[0].place || d.items[0].city || d.items[0].name || '';
  }
  else if (d?.geo) { geo = d.geo; detail = type === 'iss' ? tr('iss_position') : ''; }
  eventLog.unshift({ type, time: new Date().toLocaleTimeString(), color: EVT_COLORS[type]||'#506080', geo, detail });
  if (eventLog.length > 30) eventLog.pop();
  renderEventFeed();
}

// Fly to event location when clicked
function flyToEvent(index) {
  const ev = eventLog[index];
  if (!ev?.geo || !cesiumViewer) return;
  const alt = ev.type === 'earthquake' ? 600000 : ev.type === 'iss' ? 2000000 : 1200000;
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(ev.geo.lon, ev.geo.lat, alt),
    duration: 2.5,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
  });
}

// ==================== AI INSIGHTS (clean, left panel) ====================
const AI_ICONS = { earthquake:'⚠', space_weather:'☀', weather:'🌡', aviation:'✈', marine:'🌊', ships:'⛴', iss:'🛰', correlation:'🔗' };
function getAILabel(type) {
  const m = {
    earthquake: tr('ai_seismic'), space_weather: tr('ai_space'), weather: tr('ai_weather'), aviation: tr('ai_aviation'),
    marine: tr('ai_marine'), ships: tr('ai_ships'), iss: tr('ai_iss'), correlation: tr('ai_correlation')
  };
  return m[type] || type.toUpperCase();
}
function cleanAIText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let t = raw
    .replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*?\}/g, '').replace(/\[[\s\S]*?\]/g, '')
    .replace(/Return ONLY[\s\S]*/gi, '').replace(/Answer in JSON[\s\S]*/gi, '')
    .replace(/<[^>]+>/g, '').replace(/You are a[\s\S]*?analyst[.\s]*/gi, '')
    .replace(/Analyze the following[\s\S]*?:/gi, '').replace(/Based on[\s\S]*?data:/gi, '')
    .replace(/^[\s\-#*>]+/gm, '').replace(/\n{2,}/g, '\n').trim();
  return t.split(/[.\n]/).filter(s => s.trim().length > 10 && s.trim().length < 300).slice(0, 4).join('. ').trim();
}
async function fetchAIInsights() {
  const el = document.getElementById('ai-insight-content');
  try {
    const res = await fetch(`${API}/ai/analysis`);
    const analysis = await res.json();
    if (analysis && Object.keys(analysis).length > 0) {
      let html = '';
      for (const [type, result] of Object.entries(analysis)) {
        const level = result.alert_level || result.threat_level || 1;
        const clean = cleanAIText(result.summary || result.conclusion || '');
        if (!clean || clean.length < 10) continue;
        const label = getAILabel(type);
        const icon = AI_ICONS[type] || '📊';
        const borderCol = level >= 4 ? '#ff1744' : level >= 3 ? '#ff9100' : '#00e5ff';
        html += `<div class="ai-card" style="border-left:4px solid ${borderCol}">`;
        html += `<div class="ai-card-header"><span style="font-size:18px">${icon}</span><span class="ai-badge level-${Math.min(5,level)}">${tr('ai_lvl')} ${level}</span><span class="ai-card-type">${label}</span></div>`;
        html += `<div class="ai-card-text">${clean.slice(0, 250)}</div></div>`;
      }
      if (el) el.innerHTML = html || `<div class="ai-card"><div class="ai-card-text">${tr('ai_wait')}</div></div>`;
    } else {
      if (el) el.innerHTML = `<div class="ai-card"><div class="ai-card-text">${tr('ai_collect')}</div></div>`;
    }
  } catch(e) { if (el) el.innerHTML = `<div class="ai-card"><div class="ai-card-text">${tr('ai_standby')}</div></div>`; }
  setTimeout(fetchAIInsights, 25000);
}

// ==================== UI ZOOM (scales text only, not layout) ====================
let uiScale = 1.0;
function initUIZoom() {
  const el = document.getElementById('ui-zoom'); if (!el) return;
  el.innerHTML = `<button onclick="changeUIScale(-0.1)">−</button><span id="zoom-val">100%</span><button onclick="changeUIScale(0.1)">+</button>`;
}
function changeUIScale(delta) {
  uiScale = Math.max(0.8, Math.min(1.4, uiScale + delta));
  document.getElementById('zoom-val').textContent = Math.round(uiScale*100) + '%';
  // Scale side panels only - globe stays untouched
  document.querySelectorAll('#left-panel, #right-panel, #topbar, #bottombar').forEach(el => {
    el.style.zoom = uiScale;
  });
}

// ==================== ENTITY CLICK → INFO POPUP ====================
function initEntityClick() {
  if (!cesiumViewer) return;
  const handler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
  handler.setInputAction(click => {
    const picked = cesiumViewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?._rcData) showInfoPopup(picked.id._rcData, picked.id._rcType);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
function showInfoPopup(d, type) {
  const el = document.getElementById('info-popup');
  const content = document.getElementById('info-popup-content');
  if (!el || !content) return;
  el.classList.remove('hidden');
  let html = '';
  if (type === 'earthquake') {
    const mag = Number(d.magnitude || 0);
    const sev = mag >= 8 ? tr('sev_extreme') : mag >= 7 ? tr('sev_major') : mag >= 6 ? tr('sev_strong') : mag >= 5 ? tr('sev_moderate') : mag >= 4 ? tr('sev_light') : tr('sev_minor');
    const sevColor = mag >= 6 ? '#ff1744' : mag >= 4.5 ? '#ff9100' : '#ffd600';
    const tsunami = mag >= 6.5 && (d.depth || 999) < 70 ? tr('tsu_high') : mag >= 6 ? tr('tsu_medium') : tr('tsu_low');
    html = `<div style="text-align:center;font-family:Orbitron;font-size:36px;font-weight:900;color:${sevColor};margin-bottom:6px">${tr('popup_richter')} ${mag.toFixed(2)}</div>
      <div style="text-align:center;font-size:18px;margin-bottom:10px;color:${sevColor};font-family:Orbitron;letter-spacing:2px">${sev}</div>
      <div style="text-align:center;font-size:18px;margin-bottom:14px">${d.place||tr('unknown')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px;margin-bottom:10px">
      <span style="color:var(--text2)">${tr('popup_depth')}</span><span>${d.depth||'?'} km</span>
      <span style="color:var(--text2)">${tr('popup_tsunami')}</span><span style="color:${tsunami === tr('tsu_high') ? '#ff1744' : tsunami === tr('tsu_medium') ? '#ff9100' : '#00ff88'}">${tsunami}</span>
      <span style="color:var(--text2)">${tr('popup_time')}</span><span>${d.time ? new Date(d.time).toLocaleString() : '?'}</span>
      <span style="color:var(--text2)">${tr('popup_latlon')}</span><span>${d.geo?.lat?.toFixed(3)||'?'} / ${d.geo?.lon?.toFixed(3)||'?'}</span></div>
      <div style="font-size:13px;line-height:1.5;color:var(--text2);border-top:1px solid rgba(255,255,255,.12);padding-top:8px">
        ${tr('popup_guide')}
      </div>`;
  } else if (d._isAlert) {
    const col = d.severity >= 4 ? '#ff1744' : d.severity >= 3 ? '#ff9100' : '#ffd600';
    html = `<div style="text-align:center;font-family:Orbitron;font-size:30px;font-weight:900;color:${col};margin-bottom:8px">⚡ ${tr('popup_alert_lvl')} ${d.severity}</div>
      <div style="text-align:center;font-size:18px;margin-bottom:14px">${d.category||tr('system')}</div>
      <div style="font-size:16px;line-height:1.7;margin-bottom:12px">${d.summary||''}</div>
      <div style="font-size:13px;color:var(--text2)">${tr('popup_confidence')}: ${((d.confidence||0)*100).toFixed(0)}%</div>
      <button onclick="ackAlert('${d.id}');closePopup()" style="margin-top:12px;padding:8px 20px;background:rgba(255,23,68,.15);border:1px solid ${col};color:${col};border-radius:6px;cursor:pointer;font-family:Orbitron;font-size:12px;letter-spacing:1px">${tr('popup_ack')}</button>`;
  }
  content.innerHTML = html;
}
function closePopup() { document.getElementById('info-popup')?.classList.add('hidden'); }

// ==================== STATUS BAR ====================
function renderConnectorStatuses(connectors) {
  const el = document.getElementById('connector-statuses'); if (!el || !connectors) return;
  el.innerHTML = connectors.map(c => {
    const ok = c.status === 'ok' || c.status === 'running';
    return `<span class="conn-item"><span class="conn-dot" style="background:${ok?'var(--green)':'var(--red)'};box-shadow:0 0 4px ${ok?'var(--green)':'var(--red)'}"></span>${c.name}</span>`;
  }).join('');
}
function renderAIStatus(ai) {
  const el = document.getElementById('ai-status'); if (!el || !ai) return;
  const bn = ai.bitnet;
  el.innerHTML = `<span style="color:${ai.running?'var(--green)':'var(--red)'}">AI:${ai.running?tr('status_on'):tr('status_off')}</span> <span style="color:${bn?.available?'var(--accent2)':'var(--text2)'}">${bn?.available?'BITNET:'+bn.mode.toUpperCase():'BITNET:'+tr('status_off')}</span>`;
}
