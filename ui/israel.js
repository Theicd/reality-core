const API = `${location.origin}/api`;
const _PROXY = '';  // Set to your Cloudflare Worker URL, e.g. 'https://my-proxy.workers.dev'

function _log(tag, ...a) { console.log(`%c[RC ${new Date().toISOString().substr(11,8)}][${tag}]`, 'color:#00e5ff;font-weight:bold', ...a); }
function _logErr(tag, ...a) { console.error(`%c[RC ${new Date().toISOString().substr(11,8)}][${tag}]`, 'color:#ff1744;font-weight:bold', ...a); }
function _logWarn(tag, ...a) { console.warn(`%c[RC ${new Date().toISOString().substr(11,8)}][${tag}]`, 'color:#ff9100;font-weight:bold', ...a); }
function _safeNum(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

let ws = null;
let viewer = null;

const ISRAEL_VIEW_3D = { lon: 35.2137, lat: 31.7683 };
let israelAlt = 750000;

let lastAlertId = '';
let pulsePrims = [];
let _lastActiveAreas = [];
let _alertStartTime = 0;
let _migunTimeoutId = null;
let _migunCountdownId = null;
let _lastAlertWasPre = false;
let globalMarks = [];
let _globalSig = '';
let _preferOrefUntil = 0;
const _milTracker = new Map();

const META = {
  coordsUrl: 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/area_info.py',
  migunUrl: 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/area_to_migun_time.py'
};

let _areaMeta = null;
let _modeTarget = 'columbus';
let _mapMode = 'auto';
let _israel3D = true;

const ISRAEL_BOUNDS = { minLat: 29.2, maxLat: 33.7, minLon: 34.0, maxLon: 36.0 };
const ISRAEL_EXT_BOUNDS = { minLat: 27.0, maxLat: 35.5, minLon: 31.8, maxLon: 37.8 };
const REGION_BOUNDS = { minLat: -2.0, maxLat: 42.0, minLon: 22.0, maxLon: 55.0 };
const RIFT_BOUNDS = { minLat: -4.0, maxLat: 38.0, minLon: 28.0, maxLon: 42.0 };

const live = {
  earthquake: null,
  weather: null,
  marine: null,
  space_weather: null,
  satellites: null,
  aviation: null,
  ships: null,
  iss: null
};

let aiAlerts = [];
let aiInsights = [];
let trafficMarks = [];
let satMarks = [];
const satRecCache = new Map();
let _trafficSig = '';
let _satSig = '';
let currentIsraelAlert = null;
let _lastClampAt = 0;

let _watchlist = new Set();
let _watchEnabled = true;
let _allKnownAreas = [];
try {
  const wl = JSON.parse(localStorage.getItem('ilWatchlist') || '[]');
  if (Array.isArray(wl)) wl.forEach(a => _watchlist.add(a));
  _watchEnabled = localStorage.getItem('ilWatchEnabled') !== '0';
} catch(_) {}

function saveWatchlist() {
  try {
    localStorage.setItem('ilWatchlist', JSON.stringify([..._watchlist]));
    localStorage.setItem('ilWatchEnabled', _watchEnabled ? '1' : '0');
  } catch(_) {}
}

function filterAreas(areas) {
  if (!_watchEnabled || !_watchlist.size) return areas;
  return areas.filter(a => _watchlist.has(a));
}

const _iconCache = {};
const SVG_SHAPES = {
  aircraft: (c) => `<path d="M24 8 L26 18 L38 22 L26 24 L28 36 L24 32 L20 36 L22 24 L10 22 L22 18 Z" fill="${c}" stroke="#000" stroke-width="1"/>`,
  ship: (c) => `<path d="M12 30 L16 18 L20 14 L20 10 L22 10 L22 14 L24 14 L24 10 L26 10 L26 14 L28 14 L28 18 L36 30 Z" fill="${c}" stroke="#000" stroke-width="1"/><path d="M10 32 L38 32 L36 38 L12 38 Z" fill="${c}" opacity="0.7"/>`,
  satellite: (c) => `<rect x="18" y="10" width="12" height="8" rx="1" fill="${c}" stroke="#000" stroke-width="1"/><rect x="6" y="12" width="12" height="4" fill="${c}" opacity="0.7"/><rect x="30" y="12" width="12" height="4" fill="${c}" opacity="0.7"/><circle cx="24" cy="24" r="3" fill="${c}"/><line x1="24" y1="18" x2="24" y2="21" stroke="${c}" stroke-width="2"/><line x1="20" y1="28" x2="18" y2="34" stroke="${c}" stroke-width="1.5"/><line x1="28" y1="28" x2="30" y2="34" stroke="${c}" stroke-width="1.5"/>`,
  quake: (c) => `<polygon points="24,4 28,16 40,16 30,24 34,36 24,28 14,36 18,24 8,16 20,16" fill="${c}" stroke="#000" stroke-width="1"/>`,
  wave: (c) => `<path d="M6 24 Q12 16 18 24 Q24 32 30 24 Q36 16 42 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M6 30 Q12 22 18 30 Q24 38 30 30 Q36 22 42 30" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>`,
  alert: (c) => `<polygon points="24,6 42,38 6,38" fill="none" stroke="${c}" stroke-width="2.5"/><text x="24" y="32" text-anchor="middle" fill="${c}" font-size="18" font-weight="bold">!</text>`,
  iss: (c) => `<rect x="10" y="20" width="28" height="8" rx="3" fill="${c}" stroke="#000" stroke-width="1"/><rect x="4" y="16" width="8" height="16" rx="1" fill="${c}" opacity="0.6"/><rect x="36" y="16" width="8" height="16" rx="1" fill="${c}" opacity="0.6"/><circle cx="24" cy="24" r="4" fill="#fff" stroke="${c}" stroke-width="1.5"/>`,
  rocket: (c) => `<path d="M24 4 C20 12 20 18 20 22 L16 28 L20 26 L22 40 L24 36 L26 40 L28 26 L32 28 L28 22 C28 18 28 12 24 4 Z" fill="${c}" stroke="#000" stroke-width="1"/><ellipse cx="24" cy="14" rx="2" ry="4" fill="#fff" opacity="0.7"/><circle cx="24" cy="38" r="2" fill="#ff0" opacity="0.6"/>`,
  hostile_air: (c) => `<path d="M24 10 L27 20 L42 24 L27 26 L29 36 L24 32 L19 36 L21 26 L6 24 L21 20 Z" fill="${c}" stroke="#000" stroke-width="1.5"/><circle cx="24" cy="22" r="5" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="20.5" y1="18.5" x2="27.5" y2="25.5" stroke="#fff" stroke-width="2"/><line x1="27.5" y1="18.5" x2="20.5" y2="25.5" stroke="#fff" stroke-width="2"/>`,
  siren: (c) => `<rect x="20" y="28" width="8" height="10" rx="1" fill="${c}"/><path d="M16 28 L24 14 L32 28 Z" fill="${c}" stroke="#000" stroke-width="1"/><circle cx="24" cy="22" r="5" fill="#fff" opacity="0.9"/><circle cx="24" cy="22" r="3" fill="${c}"/><rect x="17" y="38" width="14" height="4" rx="2" fill="${c}" opacity="0.6"/><line x1="12" y1="18" x2="5" y2="14" stroke="${c}" stroke-width="2" opacity="0.7"/><line x1="12" y1="24" x2="5" y2="28" stroke="${c}" stroke-width="2" opacity="0.7"/><line x1="36" y1="18" x2="43" y2="14" stroke="${c}" stroke-width="2" opacity="0.7"/><line x1="36" y1="24" x2="43" y2="28" stroke="${c}" stroke-width="2" opacity="0.7"/>`,
  hazmat: (c) => `<polygon points="24,6 42,38 6,38" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="2.5"/><circle cx="24" cy="26" r="7" fill="none" stroke="${c}" stroke-width="2"/><path d="M24 19 L24 24" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="30" r="1.5" fill="${c}"/>`
};
function makeSvgIcon(type, size, color) {
  const key = `svg_${type}_${size}_${color}`;
  if (_iconCache[key]) return _iconCache[key];
  const s = size * 2;
  const shape = SVG_SHAPES[type] || SVG_SHAPES.alert;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 48 48"><defs><filter id="g"><feGaussianBlur stdDeviation="1.6"/></filter></defs><g filter="url(#g)" opacity="0.45">${shape(color)}</g><g>${shape(color)}</g></svg>`;
  _iconCache[key] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return _iconCache[key];
}
function makeQuakeIcon(mag) {
  const key = `quake_frame_${mag.toFixed(1)}`;
  if (_iconCache[key]) return _iconCache[key];
  const s = 96;
  const c = document.createElement('canvas'); c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  const sevCol = mag >= 6 ? '#ff0033' : mag >= 4 ? '#ff6600' : mag >= 2.5 ? '#ff9900' : '#ffcc00';
  ctx.shadowColor = sevCol; ctx.shadowBlur = 16;
  ctx.strokeStyle = sevCol; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(s/2, s/2, s/2-6, 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = sevCol + '40';
  ctx.beginPath(); ctx.arc(s/2, s/2, s/2-12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${mag >= 5 ? 36 : 30}px Orbitron, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(mag.toFixed(1), s/2, s/2);
  ctx.strokeStyle = sevCol; ctx.lineWidth = 2;
  const b = 8, e = s-8;
  ctx.beginPath(); ctx.moveTo(b,b+12); ctx.lineTo(b,b); ctx.lineTo(b+12,b); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e-12,b); ctx.lineTo(e,b); ctx.lineTo(e,b+12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e,e-12); ctx.lineTo(e,e); ctx.lineTo(e-12,e); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b+12,e); ctx.lineTo(b,e); ctx.lineTo(b,e-12); ctx.stroke();
  _iconCache[key] = c.toDataURL();
  return _iconCache[key];
}
function makeWaveBar(height, color) {
  return makeSvgIcon('wave', 24, color);
}

function $(id) { return document.getElementById(id); }

function inBounds(geo, b) {
  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return false;
  return geo.lat >= b.minLat && geo.lat <= b.maxLat && geo.lon >= b.minLon && geo.lon <= b.maxLon;
}

function removeEntities(list) {
  if (!viewer || !Array.isArray(list)) return [];
  list.forEach(e => { try { viewer.entities.remove(e); } catch(_) {} });
  return [];
}

function setModeButtons() {
  const m = _mapMode;
  ['modeAuto', 'modeIsrael', 'modeFlat', 'modeGlobe'].forEach(id => $(id)?.classList.remove('active'));
  if (m === 'auto') $('modeAuto')?.classList.add('active');
  if (m === 'israel_flat') $('modeIsrael')?.classList.add('active');
  if (m === 'flat') $('modeFlat')?.classList.add('active');
  if (m === 'globe') $('modeGlobe')?.classList.add('active');
  const t3d = $('mode3dToggle');
  if (t3d) {
    t3d.style.display = (m === 'israel_flat') ? '' : 'none';
    t3d.textContent = _israel3D ? '3D' : '2D';
    t3d.classList.toggle('active', _israel3D);
  }
}

function updateDepthReadout() {
  const out = $('depthVal');
  if (!out) return;
  let camKm = '---';
  try { camKm = `${Math.round((viewer?.camera?.positionCartographic?.height || 0) / 1000)}km`; } catch(_) {}
  out.textContent = `${Math.round(israelAlt / 1000)}km יעד | ${camKm}`;
}

function setConn(ok) {
  const dot = $('connDot');
  if (!dot) return;
  dot.style.background = ok ? '#00ff88' : '#ff1744';
  dot.style.boxShadow = ok ? '0 0 10px rgba(0,255,136,.35)' : '0 0 12px rgba(255,23,68,.35)';
}

function showToast(text, durationMs = 4500, html = false) {
  const toast = $('toast');
  const t = $('toastText');
  if (!toast || !t) return;
  if (html) t.innerHTML = text; else t.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), durationMs);
}

function clearPulses() {
  if (!viewer) return;
  pulsePrims.forEach(p => {
    try { viewer.entities.remove(p); } catch(e) {}
  });
  pulsePrims = [];
}

function clearGlobalMarks() {
  globalMarks = removeEntities(globalMarks);
}

function clearTrafficMarks() {
  trafficMarks = removeEntities(trafficMarks);
}

function clearSatMarks() {
  satMarks = removeEntities(satMarks);
}

function _alertCatToIcon(category) {
  const cat = Number(category) || 0;
  if (cat === 1 || cat === 13) return { type: 'rocket', emoji: '\ud83d\ude80' };
  if (cat === 2) return { type: 'hostile_air', emoji: '\u2708\ufe0f' };
  if (cat === 3) return { type: 'quake', emoji: '\u26a0\ufe0f' };
  if (cat === 4) return { type: 'wave', emoji: '\ud83c\udf0a' };
  if (cat === 5 || cat === 6) return { type: 'hazmat', emoji: '\u2622\ufe0f' };
  return { type: 'siren', emoji: '\ud83d\udea8' };
}

function _rtl(s) {
  if (!s || !/[\u0590-\u05FF]/.test(s)) return s;
  return s.split('\n').map(ln => {
    if (!/[\u0590-\u05FF]/.test(ln)) return ln;
    const ch = [...ln], parts = [];
    let i = 0;
    while (i < ch.length) {
      let j = i, heb = /[\u0590-\u05FF]/.test(ch[i]);
      while (j < ch.length) {
        const h = /[\u0590-\u05FF]/.test(ch[j]);
        if (!/[\s,.\-!?;:'"()\u05F3\u05F4]/.test(ch[j]) && h !== heb) break;
        if (h) heb = true;
        j++;
      }
      const seg = ch.slice(i, j).join('');
      parts.push(heb ? [...seg].reverse().join('') : seg);
      i = j;
    }
    return parts.reverse().join('');
  }).join('\n');
}

function addPulseAt(lon, lat, colorCss = '#ff1744', areaName = '', isClear = false, category = 0) {
  if (!viewer) return;
  const color = Cesium.Color.fromCssColorString(colorCss);
  const catInfo = isClear ? { type: 'alert', emoji: '\u2705' } : _alertCatToIcon(category);
  const icon = makeSvgIcon(catInfo.type, 28, colorCss);
  const start = performance.now();

  const marker = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    billboard: {
      image: icon, width: isClear ? 44 : 52, height: isClear ? 44 : 52,
      rotation: isClear ? 0 : new Cesium.CallbackProperty(() => -((performance.now() - start) / 800 % (Math.PI * 2)), false)
    },
    label: areaName ? { text: _rtl(`${catInfo.emoji} ${areaName}`), font: 'bold 15px Rajdhani', fillColor: color, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(isClear ? 28 : 32, 0), showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.85) } : undefined
  });
  pulsePrims.push(marker);

  if (!isClear) {
    const isPreAlert = Number(category) === 14;
    const maxR = isPreAlert ? 6000 : 25000;
    const baseR = isPreAlert ? 1500 : 5000;
    const baseAlpha = isPreAlert ? 0.08 : 0.15;
    const outAlpha = isPreAlert ? 0.2 : 0.4;
    const pulse = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      ellipse: {
        semiMajorAxis: new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 2.5) / 2.5; return baseR + k * maxR; }, false),
        semiMinorAxis: new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 2.5) / 2.5; return baseR + k * maxR; }, false),
        material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 2.5) / 2.5; return color.withAlpha(baseAlpha * (1 - k)); }, false)),
        outline: true,
        outlineColor: new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 2.5) / 2.5; return color.withAlpha(outAlpha * (1 - k)); }, false),
        height: 0
      }
    });
    pulsePrims.push(pulse);
  }
}

function addPointAt(lon, lat, colorCss, label) {
  if (!viewer) return null;
  const col = Cesium.Color.fromCssColorString(colorCss);
  const e = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    point: { pixelSize: 7, color: col, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
    label: label ? { text: _rtl(label), font: 'bold 13px Rajdhani', fillColor: col, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(10, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000) } : undefined
  });
  globalMarks.push(e);
  return e;
}

function setSceneMode(mode, duration = 0.8) {
  if (!viewer) return;
  const scene = viewer.scene;
  try {
    if (mode === 'columbus' && scene.mode !== Cesium.SceneMode.COLUMBUS_VIEW) scene.morphToColumbusView(duration);
    if (mode === '3d' && scene.mode !== Cesium.SceneMode.SCENE3D) scene.morphTo3D(duration);
    _modeTarget = mode;
  } catch(_) {}
}

function enforceAutoMode() {
  if (!viewer || _mapMode !== 'auto') return;
  let h = 0;
  try { h = viewer.camera.positionCartographic.height; } catch(_) { return; }
  if (h > 6500000) setSceneMode('3d', 0.9);
  else setSceneMode('columbus', 0.9);
}

function setMapMode(mode, fly = true) {
  _mapMode = mode;
  try { localStorage.setItem('israelMapMode', mode); } catch(_) {}
  _globalSig = '';
  _trafficSig = '';
  _satSig = '';
  clearGlobalMarks();
  clearTrafficMarks();
  clearSatMarks();
  setModeButtons();
  if (mode === 'israel_flat') {
    setSceneMode('columbus', 0.7);
    if (fly) focusIsrael(1.0);
    setTimeout(refreshComposite, 900);
    return;
  }
  if (mode === 'flat') {
    setSceneMode('columbus', 0.7);
    if (fly && viewer) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(30, 15, 50000000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO + 0.01, roll: 0 },
        duration: 1.5
      });
    }
    setTimeout(refreshComposite, 1000);
    return;
  }
  if (mode === 'globe') {
    setSceneMode('3d', 0.7);
    if (fly && viewer) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(35, 25, 18000000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO + 0.3, roll: 0 },
        duration: 1.2
      });
    }
    setTimeout(refreshComposite, 900);
    return;
  }
  enforceAutoMode();
}

function focusIsrael(duration = 1.6) {
  if (!viewer) return;
  if (_israel3D) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(ISRAEL_VIEW_3D.lon, ISRAEL_VIEW_3D.lat - 1.8, israelAlt),
      orientation: { heading: 0, pitch: -1.05, roll: 0 },
      duration
    });
  } else {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(ISRAEL_VIEW_3D.lon, ISRAEL_VIEW_3D.lat, israelAlt),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO + 0.01, roll: 0 },
      duration
    });
  }
}

function focusGeo(lon, lat, alt = israelAlt) {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
    orientation: (_mapMode === 'israel_flat' || _mapMode === 'flat') ? { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO + 0.01, roll: 0 } : undefined,
    duration: 1.25
  });
}

async function loadAreaMeta() {
  if (_areaMeta) return _areaMeta;
  const [coordsText, migunText] = await Promise.all([
    fetch(META.coordsUrl).then(r => r.text()),
    fetch(META.migunUrl).then(r => r.text())
  ]);

  const coords = new Map();
  const migun = new Map();

  const reCoord = /"([^"]+)"\s*:\s*\{[^}]*?"lat"\s*:\s*([0-9.]+)[^}]*?"lon"\s*:\s*([0-9.]+)/gms;
  let m;
  while ((m = reCoord.exec(coordsText))) coords.set(m[1], { lat: Number(m[2]), lon: Number(m[3]) });

  const reMigun = /"([^"]+)"\s*:\s*(\d+)/g;
  while ((m = reMigun.exec(migunText))) migun.set(m[1], Number(m[2]));

  _areaMeta = { coords, migun };
  _allKnownAreas = [...coords.keys()].sort((a, b) => a.localeCompare(b, 'he'));
  return _areaMeta;
}

async function getAreaGeo(area) {
  try {
    const meta = await loadAreaMeta();
    const g = meta.coords.get(area);
    return g ? { lat: g.lat, lon: g.lon } : null;
  } catch(e) { return null; }
}

async function getMigunSeconds(area) {
  try {
    const meta = await loadAreaMeta();
    const s = meta.migun.get(area);
    return (s === undefined ? null : s);
  } catch(e) { return null; }
}

function initCesium() {
  Cesium.Ion.defaultAccessToken = undefined;
  viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayerPicker:false, geocoder:false, homeButton:false,
    sceneModePicker:false, navigationHelpButton:false, animation:false,
    timeline:false, fullscreenButton:false, vrButton:false,
    infoBox:false, selectionIndicator:false,
    skyBox:false,
    scene3DOnly:false,
    imageryProvider: false
  });

  viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
    url:'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    maximumLevel:18,
    credit:'CartoDB'
  }));

  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#030810');
  scene.globe.enableLighting = false;
  scene.fog.enabled = true;
  scene.fog.density = 2e-4;
  scene.globe.showGroundAtmosphere = true;

  try {
    setSceneMode('columbus', 0);
  } catch(e) {}

  let bootMode = 'israel_flat';
  try {
    const saved = localStorage.getItem('israelMapMode');
    if (['auto', 'israel_flat', 'flat', 'globe'].includes(saved)) bootMode = saved;
  } catch(_) {}

  _mapMode = bootMode;
  setModeButtons();
  updateDepthReadout();
  setTimeout(() => setMapMode(bootMode, true), 300);

  viewer.camera.changed.addEventListener(() => {
    try {
      updateDepthReadout();

      if (_mapMode === 'auto') {
        enforceAutoMode();
        return;
      }

      if (_mapMode === 'israel_flat') {
        setSceneMode('columbus', 0);
        const c = viewer.camera.positionCartographic;
        const lon = Cesium.Math.toDegrees(c.longitude);
        const lat = Cesium.Math.toDegrees(c.latitude);
        const alt = Math.max(220000, Math.min(2200000, c.height));
        const clampedLon = Math.max(ISRAEL_EXT_BOUNDS.minLon, Math.min(ISRAEL_EXT_BOUNDS.maxLon, lon));
        const clampedLat = Math.max(ISRAEL_EXT_BOUNDS.minLat, Math.min(ISRAEL_EXT_BOUNDS.maxLat, lat));
        const outOfBounds = Math.abs(lon - clampedLon) > 0.01 || Math.abs(lat - clampedLat) > 0.01;
        const badPitch = _israel3D ? false : (viewer.camera.pitch > -1.45 || viewer.camera.pitch < -1.58);
        if ((outOfBounds || badPitch) && Date.now() - _lastClampAt > 220) {
          _lastClampAt = Date.now();
          const targetPitch = _israel3D ? viewer.camera.pitch : (-Cesium.Math.PI_OVER_TWO + 0.01);
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(clampedLon, clampedLat, alt),
            orientation: { heading: viewer.camera.heading, pitch: targetPitch, roll: 0 }
          });
        }
        return;
      }

      if (_mapMode === 'flat') {
        setSceneMode('columbus', 0);
      }

      if (_mapMode === 'globe') {
        setSceneMode('3d', 0);
      }
    } catch(e) {}
  });
}

function hash01(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function cut(s, len = 120) {
  const t = String(s || '');
  return t.length > len ? `${t.slice(0, len - 1)}…` : t;
}

function pushAiAlert(a) {
  if (!a || !a.id) return;
  const id = String(a.id);
  aiAlerts = [a, ...aiAlerts.filter(x => String(x.id) !== id)].slice(0, 40);
}

function pushAiInsight(v) {
  if (!v) return;
  aiInsights = [v, ...aiInsights].slice(0, 25);
}

function isGlobalMode() {
  return _mapMode === 'flat' || _mapMode === 'globe' || (_mapMode === 'auto' && viewer?.camera?.positionCartographic?.height > 5000000);
}

function renderTrafficLayer() {
  const av = Array.isArray(live.aviation?.items) ? live.aviation.items : [];
  const sh = Array.isArray(live.ships?.items) ? live.ships.items : [];
  const global = isGlobalMode();
  const planes = global ? av.filter(x => x.geo).slice(0, 200) : av.filter(x => x.geo && inBounds(x.geo, REGION_BOUNDS)).slice(0, 120);
  const ships = global ? sh.filter(x => x.geo).slice(0, 200) : sh.filter(x => x.geo && inBounds(x.geo, REGION_BOUNDS)).slice(0, 120);
  const sig = `${_mapMode}|${planes.length}|${ships.length}|${av[0]?.timestamp || ''}|${sh[0]?.timestamp || ''}`;
  if (sig === _trafficSig && trafficMarks.length) return;
  _trafficSig = sig;
  clearTrafficMarks();

  const planeIcon = makeSvgIcon('aircraft', 28, '#ffd600');
  const milIcon = makeSvgIcon('hostile_air', 30, '#ff1744');
  planes.forEach(p => {
    if (!Number.isFinite(p.geo?.lat) || !Number.isFinite(p.geo?.lon)) return;
    const isMil = p.isMilitary || _classifyAircraft(p.icao24, p.callsign, p.country, p.category).mil;
    const alt = _safeNum(p.altitude, _safeNum(p.geo.alt, 10000));
    const icon = isMil ? milIcon : planeIcon;
    const col = isMil ? '#ff1744' : '#ffd600';
    const lbl = _rtl(isMil ? `\u26a0 ${p.callsign || p.icao24 || ''} ${p.milLabel || p.country || ''}` : `${p.callsign || p.icao24 || ''} ${p.country || ''}`);
    const e = viewer?.entities?.add?.({
      position: Cesium.Cartesian3.fromDegrees(p.geo.lon, p.geo.lat, alt),
      billboard: { image: icon, width: isMil ? 52 : 44, height: isMil ? 52 : 44, rotation: p.heading ? -Cesium.Math.toRadians(p.heading) : 0 },
      label: { text: lbl, font: `bold ${isMil ? 15 : 14}px Rajdhani`, fillColor: Cesium.Color.fromCssColorString(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(isMil ? 32 : 26, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000), showBackground: isMil, backgroundColor: isMil ? Cesium.Color.BLACK.withAlpha(0.85) : undefined }
    });
    if (e) { e._rcType = 'aviation'; e._rcData = p; trafficMarks.push(e); }
    const tr = isMil ? _milTracker.get(p.icao24) : null;
    if (tr && tr.trail.length >= 2) {
      const positions = tr.trail.filter(pt => Number.isFinite(pt.lon) && Number.isFinite(pt.lat)).map(pt => Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, _safeNum(pt.alt, alt)));
      if (positions.length >= 2) {
      const trail = viewer?.entities?.add?.({
        polyline: { positions, width: 3, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.3, color: Cesium.Color.RED.withAlpha(0.6) }), clampToGround: false }
      });
      if (trail) trafficMarks.push(trail);
      }
    } else if (Number.isFinite(p.heading)) {
      const hdg = _safeNum(p.heading) * Math.PI / 180;
      const t = viewer?.entities?.add?.({
        polyline: { positions: [
          Cesium.Cartesian3.fromDegrees(p.geo.lon - Math.sin(hdg) * 3, p.geo.lat - Math.cos(hdg) * 3, alt),
          Cesium.Cartesian3.fromDegrees(p.geo.lon, p.geo.lat, alt)
        ], width: 3, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.25, color: Cesium.Color.YELLOW.withAlpha(0.45) }) }
      });
      if (t) trafficMarks.push(t);
    }
  });

  const shipSmall = makeSvgIcon('ship', 18, '#00bfa5');
  const shipMed = makeSvgIcon('ship', 24, '#00e5ff');
  const shipLarge = makeSvgIcon('ship', 30, '#26c6da');
  const shipTanker = makeSvgIcon('ship', 28, '#ff9100');
  const shipMil = makeSvgIcon('ship', 26, '#ff1744');
  ships.forEach(s => {
    if (!Number.isFinite(s.geo?.lat) || !Number.isFinite(s.geo?.lon)) return;
    const st = s.shipType || 0;
    const isCargo = st >= 70 && st <= 79;
    const isTanker = st >= 80 && st <= 89;
    const isPax = st >= 60 && st <= 69;
    const isMilShip = st === 35;
    const icon = isMilShip ? shipMil : isTanker ? shipTanker : isCargo ? shipLarge : isPax ? shipMed : shipSmall;
    const sz = isCargo || isTanker ? 36 : isPax || isMilShip ? 28 : 22;
    const col = isMilShip ? '#ff1744' : isTanker ? '#ff9100' : isCargo ? '#26c6da' : isPax ? '#00e5ff' : '#00bfa5';
    const lbl = _rtl(s.name ? `${s.name}${s.shipTypeName ? ' · ' + s.shipTypeName : ''}` : (s.shipTypeName || ''));
    const e = viewer?.entities?.add?.({
      position: Cesium.Cartesian3.fromDegrees(s.geo.lon, s.geo.lat, 0),
      billboard: { image: icon, width: sz, height: sz, rotation: s.heading ? -Cesium.Math.toRadians(s.heading) : 0 },
      label: { text: lbl, font: `bold ${isCargo || isTanker ? 14 : 12}px Rajdhani`, fillColor: Cesium.Color.fromCssColorString(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(sz/2 + 6, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isCargo || isTanker ? 5000000 : 2500000), showBackground: isMilShip, backgroundColor: isMilShip ? Cesium.Color.BLACK.withAlpha(0.85) : undefined }
    });
    if (e) { e._rcType = 'ships'; e._rcData = s; trafficMarks.push(e); }
  });
}

function satrecFor(s) {
  if (!window.satellite || !s?.tle1 || !s?.tle2) return null;
  const key = `${s.noradId || s.name}|${s.tle1}|${s.tle2}`;
  if (satRecCache.has(key)) return satRecCache.get(key);
  try {
    const rec = window.satellite.twoline2satrec(s.tle1, s.tle2);
    satRecCache.set(key, rec);
    return rec;
  } catch(_) {
    return null;
  }
}

function satGeo(satItem, date) {
  const rec = satrecFor(satItem);
  if (!rec || !window.satellite) return null;
  try {
    const pv = window.satellite.propagate(rec, date);
    if (!pv?.position) return null;
    const gmst = window.satellite.gstime(date);
    const g = window.satellite.eciToGeodetic(pv.position, gmst);
    const lat = window.satellite.degreesLat(g.latitude);
    const lon = window.satellite.degreesLong(g.longitude);
    const hKm = g.height;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(hKm)) return null;
    return { lat, lon, hKm };
  } catch(_) {
    return null;
  }
}

function computeOrbitTrail(satItem, now, steps = 40, stepMin = 2) {
  const pts = [];
  for (let i = -steps / 2; i <= steps / 2; i++) {
    const t = new Date(now.getTime() + i * stepMin * 60000);
    const g = satGeo(satItem, t);
    if (g && g.hKm > 0) pts.push(g);
  }
  return pts;
}

function renderSatellitesLayer() {
  const strip = $('satStrip');
  const sats = Array.isArray(live.satellites?.items) ? live.satellites.items : [];
  const hasTLE = window.satellite && sats.some(s => s.tle1 && s.tle2);

  if (!sats.length && !live.iss) {
    clearSatMarks();
    _satSig = '';
    if (strip) strip.textContent = 'לוויינים: אין נתונים';
    return;
  }

  const now = new Date();
  const global = isGlobalMode();
  const over = [];

  if (hasTLE) {
    const scanLimit = global ? 300 : 200;
    sats.slice(0, scanLimit).forEach(s => {
      const g = satGeo(s, now);
      if (!g || g.hKm <= 0) return;
      if (global || inBounds(g, REGION_BOUNDS)) over.push({ item: s, geo: g });
    });
  } else {
    sats.forEach(s => {
      const inc = parseFloat(s.inclination) || 45;
      const mm = parseFloat(s.meanMotion) || 14;
      const alt = Math.max(200, Math.min(Math.pow(8681663.653/mm,2/3)*1000-6371000, 36000000));
      const raan = (over.length * 47) % 360, startA = (over.length * 73) % 360;
      const iR = inc*Math.PI/180, rR = raan*Math.PI/180, aR = startA*Math.PI/180;
      const lat = Math.asin(Math.sin(iR)*Math.sin(aR))*180/Math.PI;
      const lon = (Math.atan2(Math.sin(aR)*Math.cos(iR),Math.cos(aR))+rR)*180/Math.PI;
      const g = { lat, lon: ((lon % 360) + 540) % 360 - 180, hKm: alt / 1000 };
      if (global || inBounds(g, REGION_BOUNDS)) over.push({ item: s, geo: g });
    });
  }

  const maxShow = global ? 50 : 30;
  const sig = `${_mapMode}|${Math.floor(now.getTime() / 5000)}|${over.length}`;
  if (sig !== _satSig || satMarks.length === 0) {
    _satSig = sig;
    clearSatMarks();
    const satSvg = makeSvgIcon('satellite', 28, '#4fc3f7');
    const issSvg = makeSvgIcon('iss', 34, '#7c4dff');

    over.slice(0, maxShow).forEach(x => {
      const isISS = /ISS|ZARYA|25544/i.test(x.item.name || '') || x.item.noradId === 25544;
      const icon = isISS ? issSvg : satSvg;
      const sz = isISS ? 52 : 40;
      const col = isISS ? '#b388ff' : '#4fc3f7';
      const e = viewer?.entities?.add?.({
        position: Cesium.Cartesian3.fromDegrees(x.geo.lon, x.geo.lat, x.geo.hKm * 1000),
        billboard: { image: icon, width: sz, height: sz },
        label: { text: isISS ? `ISS ${x.geo.lat.toFixed(1)}° ${x.geo.lon.toFixed(1)}°` : (x.item.name || ''), font: `bold ${isISS ? 16 : 15}px Rajdhani`, fillColor: Cesium.Color.fromCssColorString(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(sz/2 + 4, 0), showBackground: isISS, backgroundColor: isISS ? Cesium.Color.fromCssColorString('#1a0033').withAlpha(0.8) : undefined, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 12000000) }
      });
      if (e) { e._rcType = isISS ? 'iss' : 'satellite'; e._rcData = { ...x.item, geo: x.geo, altitude: x.geo.hKm }; satMarks.push(e); }

      if (hasTLE) {
        const trail = computeOrbitTrail(x.item, now, 50, 1.5);
        if (trail.length > 4) {
          const positions = trail.map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.hKm * 1000));
          const trailE = viewer?.entities?.add?.({
            polyline: { positions, width: isISS ? 2.5 : 1.5,
              material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.15, color: Cesium.Color.fromCssColorString(col).withAlpha(isISS ? 0.45 : 0.3) }) }
          });
          if (trailE) satMarks.push(trailE);
        }
      }
    });

    if (live.iss?.geo && Number.isFinite(live.iss.geo.lat) && Number.isFinite(live.iss.geo.lon) && !over.some(x => /ISS|ZARYA|25544/i.test(x.item.name || ''))) {
      const ig = live.iss.geo;
      const e = viewer?.entities?.add?.({
        position: Cesium.Cartesian3.fromDegrees(ig.lon, ig.lat, 408000),
        billboard: { image: issSvg, width: 52, height: 52 },
        label: { text: `ISS ${ig.lat.toFixed(1)}° ${ig.lon.toFixed(1)}°`, font: 'bold 16px Rajdhani', fillColor: Cesium.Color.fromCssColorString('#b388ff'), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(30, 0), showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#1a0033').withAlpha(0.8) }
      });
      if (e) { e._rcType = 'iss'; e._rcData = { name: 'ISS (ZARYA)', noradId: 25544, geo: ig, altitude: 408 }; satMarks.push(e); }
    }
  }

  const ilOver = over.filter(x => inBounds(x.geo, ISRAEL_BOUNDS));
  const issFound = over.find(x => /ISS|ZARYA|25544/i.test(x.item.name || '')) || (live.iss?.geo ? { geo: live.iss.geo } : null);
  const issText = issFound ? ` | ISS: ${issFound.geo.lat.toFixed(1)}°, ${issFound.geo.lon.toFixed(1)}°` : '';
  if (strip) {
    strip.textContent = global
      ? `לוויינים: ${over.length}${issText}`
      : `לוויינים באזור: ${over.length} (${ilOver.length} מעל ישראל)${issText}`;
  }
}

function severityTag(sev) {
  if (sev >= 5) return 'pill red';
  if (sev >= 3) return 'pill amber';
  return 'pill';
}

function updateGaugeCards() {
  const eqAll = Array.isArray(live.earthquake?.items) ? live.earthquake.items : [];
  const eqNear = eqAll.filter(x => x.geo && (inBounds(x.geo, REGION_BOUNDS) || inBounds(x.geo, RIFT_BOUNDS))).sort((a, b) => (n(b.magnitude) || 0) - (n(a.magnitude) || 0));
  const topEq = eqNear[0] || eqAll.sort((a, b) => (n(b.magnitude) || 0) - (n(a.magnitude) || 0))[0];
  if (topEq) {
    const mag = n(topEq.magnitude) || 0;
    const depth = n(topEq.depth);
    const el = $('gEqVal'); if (el) el.textContent = `M ${mag.toFixed(1)}`;
    const sub = $('gEqSub'); if (sub) sub.textContent = `${cut(topEq.place || '', 30)}${depth !== null ? ` | ${Math.round(depth)} km` : ''}`;
    const bar = $('gEqBar'); if (bar) bar.style.width = `${Math.min(100, (mag / 9) * 100)}%`;
    if (el) el.style.color = mag >= 6 ? 'var(--red)' : mag >= 4 ? 'var(--amber)' : '#ffd600';
  }

  const marineAll = Array.isArray(live.marine?.items) ? live.marine.items : [];
  const marineNear = marineAll.filter(x => x.geo && inBounds(x.geo, REGION_BOUNDS));
  const topWave = [...marineNear].sort((a, b) => (n(b.waveHeight) || 0) - (n(a.waveHeight) || 0))[0] || [...marineAll].sort((a, b) => (n(b.waveHeight) || 0) - (n(a.waveHeight) || 0))[0];
  if (topWave) {
    const wh = n(topWave.waveHeight) || 0;
    const tide = n(topWave.tide);
    const wTemp = topWave.waterTemp;
    const el = $('gWaveVal'); if (el) el.textContent = `${wh.toFixed(1)} m`;
    const sub = $('gWaveSub'); if (sub) sub.textContent = `${cut(topWave.station || '', 20)}${tide !== null ? ` | Tide ${tide.toFixed(1)}` : ''}${wTemp ? ` | ${wTemp}°C` : ''}`;
    const bar = $('gWaveBar'); if (bar) bar.style.width = `${Math.min(100, (wh / 12) * 100)}%`;
    if (el) el.style.color = wh >= 5 ? 'var(--red)' : wh >= 3 ? 'var(--amber)' : '#00bcd4';
  }

  const wxAll = Array.isArray(live.weather?.items) ? live.weather.items : [];
  const wxIl = wxAll.find(x => x.geo && inBounds(x.geo, ISRAEL_BOUNDS)) || wxAll[0];
  if (wxIl) {
    const wind = n(wxIl.windspeed) || 0;
    const temp = n(wxIl.temperature);
    const hum = n(wxIl.humidity);
    const el = $('gWindVal'); if (el) el.textContent = `${Math.round(wind)} km/h`;
    const sub = $('gWindSub');
    if (sub) {
      const parts = [cut(wxIl.city || '', 16)];
      if (temp !== null) parts.push(`${Math.round(temp)}°C`);
      if (hum !== null) parts.push(`לחות ${Math.round(hum)}%`);
      sub.textContent = parts.join(' | ');
    }
    const bar = $('gWindBar'); if (bar) bar.style.width = `${Math.min(100, (wind / 120) * 100)}%`;
    if (el) el.style.color = wind > 80 ? 'var(--red)' : wind > 50 ? 'var(--amber)' : 'var(--cyan)';
  }

  const sw = live.space_weather;
  if (sw) {
    const kp = n(sw.kpIndex) || 0;
    const solarWind = n(sw.solarWindSpeed);
    const el = $('gSpaceVal'); if (el) el.textContent = `KP ${kp.toFixed(1)}`;
    const sub = $('gSpaceSub'); if (sub) sub.textContent = solarWind ? `רוח סולארית ${Math.round(solarWind)} km/s` : '';
    const bar = $('gSpaceBar'); if (bar) bar.style.width = `${Math.min(100, (kp / 9) * 100)}%`;
    if (el) el.style.color = kp >= 7 ? 'var(--red)' : kp >= 5 ? 'var(--amber)' : 'var(--amber)';
  }
}

function buildHazardsRows() {
  const rows = [];
  if (currentIsraelAlert?.active) {
    rows.push({ t: 'RED ALERT', v: `${currentIsraelAlert.count || 0} אזורים`, s: Number(currentIsraelAlert.severity || 5), d: cut(currentIsraelAlert.summary || currentIsraelAlert.title || '') });
  }

  const eqAll = Array.isArray(live.earthquake?.items) ? live.earthquake.items : [];
  const eqNear = eqAll.filter(x => x.geo && (inBounds(x.geo, REGION_BOUNDS) || inBounds(x.geo, RIFT_BOUNDS))).sort((a, b) => (n(b.magnitude) || 0) - (n(a.magnitude) || 0));
  eqNear.slice(0, 3).forEach(eq => {
    const mag = n(eq.magnitude) || 0;
    const depth = n(eq.depth);
    rows.push({ t: 'רעידת אדמה', v: `M${mag.toFixed(1)}${depth !== null ? ` | עומק ${Math.round(depth)} km` : ''}`, s: mag >= 6 ? 5 : mag >= 4 ? 4 : 3, d: cut(eq.place || '') });
  });

  const wxAll = Array.isArray(live.weather?.items) ? live.weather.items : [];
  const wxIlItems = wxAll.filter(x => x.geo && inBounds(x.geo, ISRAEL_BOUNDS));
  const wxItem = wxIlItems[0] || wxAll[0];
  if (wxItem) {
    const wind = n(wxItem.windspeed) || 0;
    const temp = n(wxItem.temperature);
    const hum = n(wxItem.humidity);
    const pres = n(wxItem.pressure);
    const sev = wind > 90 || (temp !== null && (temp > 45 || temp < -10)) ? 4 : 2;
    let detail = cut(wxItem.city || '');
    if (hum !== null) detail += ` | לחות ${Math.round(hum)}%`;
    if (pres !== null) detail += ` | ${Math.round(pres)} hPa`;
    rows.push({ t: 'רוח / טמפ׳', v: `${Math.round(wind)} km/h | ${temp === null ? '---' : `${Math.round(temp)}°C`}`, s: sev, d: detail });
  }
  const wxExtreme = wxAll.filter(x => x.geo && ((n(x.temperature) || 0) > 42 || (n(x.temperature) || 0) < -5 || (n(x.windspeed) || 0) > 80));
  wxExtreme.slice(0, 2).forEach(w => {
    const wind = n(w.windspeed) || 0;
    const temp = n(w.temperature) || 0;
    if (wind > 80) rows.push({ t: 'סופת רוח קיצונית', v: `${Math.round(wind)} km/h`, s: 4, d: cut(w.city || w.place || '') });
    if (temp > 42) rows.push({ t: 'חום קיצוני', v: `${Math.round(temp)}°C`, s: 4, d: cut(w.city || '') });
    if (temp < -5) rows.push({ t: 'קור קיצוני', v: `${Math.round(temp)}°C`, s: 4, d: cut(w.city || '') });
  });

  const marineAll = Array.isArray(live.marine?.items) ? live.marine.items : [];
  const marineNear = marineAll.filter(x => x.geo && inBounds(x.geo, REGION_BOUNDS));
  const marineSort = [...marineNear].sort((a, b) => (n(b.waveHeight) || 0) - (n(a.waveHeight) || 0));
  marineSort.slice(0, 2).forEach(b => {
    const wave = n(b.waveHeight) || 0;
    const tide = n(b.tide);
    const wTemp = b.waterTemp;
    const sev = wave >= 5 ? 4 : wave >= 3 ? 3 : 2;
    let detail = cut(b.station || '');
    if (wTemp) detail += ` | מים ${wTemp}°C`;
    rows.push({ t: 'גלים / ים', v: `${wave.toFixed(1)}m${tide !== null ? ` | גאות ${tide.toFixed(1)}m` : ''}`, s: sev, d: detail });
  });

  const sw = live.space_weather;
  if (sw) {
    const kp = n(sw.kpIndex) || 0;
    const solarWind = n(sw.solarWindSpeed);
    let detail = '';
    if (solarWind) detail += `רוח סולארית ${Math.round(solarWind)} km/s`;
    const swAlerts = sw.alerts || [];
    if (swAlerts.length) detail += (detail ? ' | ' : '') + cut(swAlerts[0]?.message || swAlerts[0]?.product_id || '', 40);
    rows.push({ t: 'מזג אוויר חללי', v: `KP ${kp.toFixed(1)}${solarWind ? ` | ${Math.round(solarWind)} km/s` : ''}`, s: kp >= 7 ? 5 : kp >= 5 ? 4 : 2, d: detail });
  }

  const eqT = eqNear.find(x => (n(x.magnitude) || 0) >= 6.3 && (n(x.depth) || 999) < 70);
  const waveT = marineNear.find(x => (n(x.waveHeight) || 0) >= 4);
  if (eqT || waveT) rows.push({ t: 'אזהרת צונמי', v: eqT && waveT ? 'מוגבר' : 'נמוך-בינוני', s: eqT && waveT ? 4 : 3, d: cut(eqT?.place || waveT?.station || '') });

  return rows.slice(0, 24);
}

function renderHazardsPanel() {
  const box = $('hazards');
  if (!box) return;
  $('hazTime') && ($('hazTime').textContent = new Date().toLocaleTimeString());
  const strip = $('satStrip');
  if (strip && !strip.textContent) strip.textContent = 'לוויינים מעל ישראל: טוען נתונים...';
  updateGaugeCards();
  const rows = buildHazardsRows();
  if (!rows.length) {
    box.innerHTML = '<div style="color:rgba(159,179,209,.8);padding:10px 0">אין כרגע התרעות משולבות</div>';
    return;
  }
  box.innerHTML = rows.map(r => (`<div class="area"><span class="${severityTag(r.s)}">S${Math.max(1, Math.min(5, Number(r.s || 1)))}</span><span class="areaName">${escapeHtml(r.t)}: ${escapeHtml(r.v)}</span></div>${r.d ? `<div style="color:var(--text2);font-size:12px;padding:0 0 6px 42px">${escapeHtml(r.d)}</div>` : ''}`)).join('');
}

function renderGlobalHazardMarks() {
  if (!viewer) return;
  const global = isGlobalMode();

  const eq = live.earthquake;
  const wx = live.weather;
  const marine = live.marine;
  const sig = `${_mapMode}|${eq?.items?.length || 0}|${eq?.timestamp || ''}|${wx?.items?.length || 0}|${wx?.timestamp || ''}|${marine?.items?.length || 0}|${marine?.timestamp || ''}`;
  if (sig === _globalSig && globalMarks.length) return;
  _globalSig = sig;
  clearGlobalMarks();

  if (eq?.items?.length) {
    const eqFiltered = global ? eq.items.filter(x => x.geo) : eq.items.filter(x => x.geo && (inBounds(x.geo, REGION_BOUNDS) || inBounds(x.geo, RIFT_BOUNDS)));
    eqFiltered.sort((a, b) => (n(b.magnitude) || 0) - (n(a.magnitude) || 0)).slice(0, global ? 120 : 60).forEach(x => {
      const mag = n(x.magnitude) || 0;
      const icon = makeQuakeIcon(mag);
      const iconSize = Math.max(48, Math.min(80, mag * 12));
      const sevCol = mag >= 6 ? '#ff0033' : mag >= 4 ? '#ff6600' : mag >= 2.5 ? '#ff9900' : '#ffcc00';
      const ringR = Math.max(50000, mag * 80000);
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(x.geo.lon, x.geo.lat, 0),
        billboard: { image: icon, width: iconSize, height: iconSize },
        label: { text: _rtl(`RICHTER ${mag.toFixed(2)}\n${cut(x.place || '', 25)}`), font: 'bold 14px Rajdhani', fillColor: Cesium.Color.fromCssColorString(sevCol), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(iconSize/2 + 8, 0), showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#111').withAlpha(0.9) }
      });
      e._rcType = 'earthquake'; e._rcData = x;
      globalMarks.push(e);
      for (let r = 1; r <= 3; r++) {
        const ring = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(x.geo.lon, x.geo.lat, 0),
          ellipse: { semiMajorAxis: ringR * r, semiMinorAxis: ringR * r, material: Cesium.Color.TRANSPARENT, outline: true, outlineColor: Cesium.Color.fromCssColorString(sevCol).withAlpha(0.5 / r), outlineWidth: 2 }
        });
        globalMarks.push(ring);
      }
    });
  }

  if (wx?.items?.length) {
    const wxFiltered = global ? wx.items.filter(w => w.geo) : wx.items.filter(w => w.geo && inBounds(w.geo, REGION_BOUNDS));
    wxFiltered.slice(0, global ? 150 : 60).forEach(w => {
      const temp = n(w.temperature);
      if (temp === null) return;
      const col = temp > 35 ? '#ff1744' : temp > 25 ? '#ff9100' : temp > 15 ? '#ffd600' : temp > 5 ? '#00e5ff' : '#2196f3';
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(w.geo.lon, w.geo.lat, 0),
        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
        label: { text: _rtl(`${w.city || ''} ${Math.round(temp)}°C`), font: 'bold 14px Rajdhani', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(12, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6000000), showBackground: true, backgroundColor: Cesium.Color.fromCssColorString(col).withAlpha(0.3) }
      });
      e._rcType = 'weather'; e._rcData = w;
      globalMarks.push(e);
    });
  }

  if (marine?.items?.length) {
    const mFiltered = global ? marine.items.filter(b => b.geo) : marine.items.filter(b => b.geo && inBounds(b.geo, REGION_BOUNDS));
    mFiltered.slice(0, global ? 80 : 40).forEach(b => {
      const wh = n(b.waveHeight) || 0;
      if (wh <= 0) return;
      const col = wh > 4 ? '#ff1744' : wh > 2 ? '#ff9100' : '#00bcd4';
      const icon = makeWaveBar(wh, col);
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(b.geo.lon, b.geo.lat, 0),
        billboard: { image: icon, width: 40, height: 60, verticalOrigin: Cesium.VerticalOrigin.BOTTOM },
        label: { text: `${wh.toFixed(1)}m | ${b.waterTemp || '?'}°C`, font: 'bold 13px Rajdhani', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(24, -30), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000) }
      });
      e._rcType = 'marine'; e._rcData = b;
      globalMarks.push(e);
    });
  }
}

let _lastAnomalyCheck = 0;
const _seenAnomalies = new Set();

function detectAnomalies() {
  const now = Date.now();
  if (now - _lastAnomalyCheck < 30000) return;
  _lastAnomalyCheck = now;

  const eqAll = Array.isArray(live.earthquake?.items) ? live.earthquake.items : [];
  const regionEq = eqAll.filter(x => x.geo && (inBounds(x.geo, REGION_BOUNDS) || inBounds(x.geo, RIFT_BOUNDS)));
  regionEq.filter(eq => (n(eq.magnitude) || 0) >= 4.5).forEach(eq => {
    const mag = n(eq.magnitude) || 0;
    const key = `eq-${eq.id || `${mag}-${eq.time}`}`;
    if (_seenAnomalies.has(key)) return;
    _seenAnomalies.add(key);
    const tsunamiRisk = mag >= 6.3 && (n(eq.depth) || 999) < 70;
    const summary = tsunamiRisk
      ? `אזהרת צונמי: רעידה M${mag.toFixed(1)} ${cut(eq.place || '', 40)} עומק ${n(eq.depth) || '?'} km`
      : `רעידת אדמה חזקה M${mag.toFixed(1)} ${cut(eq.place || '', 40)}`;
    pushAiAlert({ id: key, category: tsunamiRisk ? 'TSUNAMI' : 'SEISMIC', severity: tsunamiRisk ? 5 : 4, summary, recommended_action: tsunamiRisk ? 'בדוק אזהרות צונמי לחופי ישראל' : 'עקוב אחרי רעידות המשך' });
    if (mag >= 5.5) { showToast(summary); window.soundSystem?.alertCritical(); }
  });

  const wxAll = Array.isArray(live.weather?.items) ? live.weather.items : [];
  wxAll.filter(w => w.geo && inBounds(w.geo, REGION_BOUNDS) && ((n(w.temperature) || 0) > 45 || (n(w.temperature) || 0) < -15 || (n(w.windspeed) || 0) > 90)).forEach(w => {
    const key = `wx-${w.city || ''}-${w.timestamp || Math.floor(now / 120000)}`;
    if (_seenAnomalies.has(key)) return;
    _seenAnomalies.add(key);
    pushAiAlert({ id: key, category: 'WEATHER', severity: 3, summary: `מזג אוויר קיצוני: ${w.city || '?'} ${Math.round(n(w.temperature) || 0)}°C רוח ${Math.round(n(w.windspeed) || 0)} km/h`, recommended_action: 'מעקב רציף' });
  });

  const marineAll = Array.isArray(live.marine?.items) ? live.marine.items : [];
  const bigWaves = marineAll.filter(b => b.geo && inBounds(b.geo, REGION_BOUNDS) && (n(b.waveHeight) || 0) > 4);
  if (bigWaves.length) {
    const key = `wave-${bigWaves.length}-${Math.floor(now / 120000)}`;
    if (!_seenAnomalies.has(key)) {
      _seenAnomalies.add(key);
      pushAiAlert({ id: key, category: 'MARITIME', severity: 3, summary: `גלים גבוהים: ${bigWaves.length} תחנות מדווחות >4m`, recommended_action: 'הימנע מפעילות ימית' });
    }
  }

  const sw = live.space_weather;
  if (sw && (n(sw.kpIndex) || 0) >= 5) {
    const key = `space-${n(sw.kpIndex)}-${Math.floor(now / 120000)}`;
    if (!_seenAnomalies.has(key)) {
      _seenAnomalies.add(key);
      pushAiAlert({ id: key, category: 'SPACE', severity: 4, summary: `סופה גיאומגנטית KP ${n(sw.kpIndex).toFixed(1)} - עלול להשפיע על תקשורת ולוויינים`, recommended_action: 'בדוק מערכות תקשורת וGPS' });
    }
  }

  const avAll = Array.isArray(live.aviation?.items) ? live.aviation.items : [];
  const milPlanes = avAll.filter(p => {
    if (!p.geo) return false;
    const inIL = inBounds(p.geo, ISRAEL_EXT_BOUNDS);
    if (!inIL) return false;
    return p.isMilitary || _classifyAircraft(p.icao24, p.callsign, p.country, p.category).mil;
  });
  milPlanes.forEach(p => {
    const id = p.icao24;
    if (!_milTracker.has(id)) _milTracker.set(id, { label: p.milLabel || _classifyAircraft(p.icao24, p.callsign, p.country, p.category).label, callsign: p.callsign, country: p.country, firstSeen: now, trail: [] });
    const tr = _milTracker.get(id);
    tr.lastSeen = now;
    tr.callsign = p.callsign || tr.callsign;
    const last = tr.trail[tr.trail.length - 1];
    if (!last || Math.abs(last.lat - p.geo.lat) > 0.002 || Math.abs(last.lon - p.geo.lon) > 0.002) {
      tr.trail.push({ lat: p.geo.lat, lon: p.geo.lon, alt: p.altitude || 0, t: now });
      if (tr.trail.length > 120) tr.trail.shift();
    }
    const cls = tr.label;
    const key = `mil-${id}-${Math.floor(now / 300000)}`;
    if (_seenAnomalies.has(key)) return;
    _seenAnomalies.add(key);
    pushAiAlert({ id: key, category: 'AVIATION', severity: 4, summary: `\u2708\ufe0f \u05de\u05d8\u05d5\u05e1 \u05dc\u05d0-\u05d0\u05d6\u05e8\u05d7\u05d9: ${cls} | ICAO: ${id} | ${p.callsign || '---'} | ${Math.round(p.altitude || 0)}m`, recommended_action: '\u05de\u05e2\u05e7\u05d1 \u05d0\u05d7\u05e8\u05d9 \u05de\u05e1\u05dc\u05d5\u05dc' });
  });
  for (const [id, tr] of _milTracker) { if (now - tr.lastSeen > 600000) _milTracker.delete(id); }
  if (milPlanes.length && !_seenAnomalies.has(`mil-toast-${Math.floor(now / 300000)}`)) {
    _seenAnomalies.add(`mil-toast-${Math.floor(now / 300000)}`);
    showToast(`\u2708\ufe0f ${milPlanes.length} \u05de\u05d8\u05d5\u05e1\u05d9\u05dd \u05dc\u05d0-\u05d0\u05d6\u05e8\u05d7\u05d9\u05d9\u05dd \u05d1\u05e9\u05de\u05d9 \u05d9\u05e9\u05e8\u05d0\u05dc`);
    window.soundSystem?.alertInfo();
  }
  _checkMilAlertCorrelation(milPlanes, now);

  if (_seenAnomalies.size > 200) { const arr = [..._seenAnomalies]; _seenAnomalies.clear(); arr.slice(-80).forEach(k => _seenAnomalies.add(k)); }
}

async function _checkMilAlertCorrelation(milPlanes, now) {
  if (!milPlanes.length || !currentIsraelAlert?.active || !_lastActiveAreas.length) return;
  const RADIUS_KM = 40;
  for (const p of milPlanes) {
    for (const area of _lastActiveAreas) {
      const geo = await getAreaGeo(area);
      if (!geo) continue;
      const dLat = (p.geo.lat - geo.lat) * 111;
      const dLon = (p.geo.lon - geo.lon) * 111 * Math.cos(geo.lat * Math.PI / 180);
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      if (distKm > RADIUS_KM) continue;
      const key = `corr-${p.icao24}-${area}-${Math.floor(now / 300000)}`;
      if (_seenAnomalies.has(key)) continue;
      _seenAnomalies.add(key);
      const tr = _milTracker.get(p.icao24);
      const trackMin = tr ? Math.round((now - tr.firstSeen) / 60000) : 0;
      const cls = p.milLabel || _classifyAircraft(p.icao24, p.callsign, p.country, p.category).label;
      pushAiAlert({ id: key, category: 'CORRELATION', severity: 5, summary: `\u26a0\ufe0f \u05e1\u05d9\u05e0\u05db\u05e8\u05d5\u05df: ${cls} (${p.icao24}) ${Math.round(distKm)} \u05e7"\u05de \u05de\u05d0\u05d6\u05d5\u05e8 \u05d4\u05ea\u05e8\u05e2\u05d4 "${area}" | \u05de\u05e2\u05e7\u05d1 ${trackMin} \u05d3\u05e7\u05d5\u05ea | ${p.callsign || '---'} ${Math.round(p.altitude || 0)}m`, recommended_action: '\u05d7\u05e9\u05d3 \u05db\u05dc\u05d9 \u05d8\u05d9\u05e1 \u05d1\u05d0\u05d6\u05d5\u05e8 \u05d4\u05ea\u05e8\u05e2\u05d4 - \u05d0\u05e4\u05e9\u05e8\u05d9 \u05e7\u05e9\u05e8' });
      const toastHtml = `<div style="color:#ff1744;font-weight:700;font-size:16px">\u26a0\ufe0f \u05e1\u05d9\u05e0\u05db\u05e8\u05d5\u05df \u05db\u05dc\u05d9 \u05d8\u05d9\u05e1 / \u05d4\u05ea\u05e8\u05e2\u05d4</div>`
        + `<div style="margin-top:4px;font-size:14px">${escapeHtml(cls)} <b>(${p.icao24})</b></div>`
        + `<div style="font-size:13px;color:var(--text2)">${Math.round(distKm)} \u05e7"\u05de \u05de\u05d0\u05d6\u05d5\u05e8 ${escapeHtml(area)} | \u05de\u05e2\u05e7\u05d1 ${trackMin} \u05d3\u05e7\u05d5\u05ea</div>`;
      const toastTitle = $('toastTitle');
      const toastInner = $('toastInner');
      if (toastTitle) { toastTitle.textContent = '\u26a0\ufe0f CORRELATION'; toastTitle.style.color = '#ff1744'; }
      if (toastInner) { toastInner.style.borderColor = 'rgba(255,23,68,.7)'; toastInner.style.background = 'rgba(255,23,68,.18)'; toastInner.style.boxShadow = '0 0 40px rgba(255,23,68,.2)'; }
      showToast(toastHtml, 10000, true);
      window.soundSystem?.alertCritical();
    }
  }
}

let _flashEnts = [];
function flashEntityAt(lon, lat, alt = 0) {
  if (!viewer) return;
  _flashEnts.forEach(e => { try { viewer.entities.remove(e); } catch(_) {} });
  _flashEnts = [];
  const start = performance.now();
  const col = Cesium.Color.fromCssColorString('#00e5ff');
  const e = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
    point: {
      pixelSize: new Cesium.CallbackProperty(() => {
        const t = (performance.now() - start) / 500;
        return 12 + Math.sin(t * Math.PI * 2) * 8;
      }, false),
      color: new Cesium.CallbackProperty(() => {
        const t = (performance.now() - start) / 500;
        return col.withAlpha(0.4 + Math.sin(t * Math.PI * 2) * 0.4);
      }, false),
      outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 40000000)
    }
  });
  _flashEnts.push(e);
  setTimeout(() => { try { viewer.entities.remove(e); } catch(_) {} _flashEnts = _flashEnts.filter(x => x !== e); }, 8000);
}

function getAiGeo(item) {
  if (item.geo) return item.geo;
  const s = item.summary || item.result?.summary || '';
  const eqAll = Array.isArray(live.earthquake?.items) ? live.earthquake.items : [];
  for (const eq of eqAll) {
    if (eq.geo && eq.place && s.includes(eq.place)) return eq.geo;
  }
  return null;
}

function aiCatClass(sev) {
  if (sev >= 4) return 'ai-cat ai-cat-red';
  if (sev >= 3) return 'ai-cat ai-cat-amber';
  return 'ai-cat ai-cat-cyan';
}

let _aiPanelSig = '';
function renderAiPanel() {
  const panel = $('aiPanel');
  const cur = $('aiCurrent');
  const hist = $('aiHistory');
  const cnt = $('aiCount');
  if (!panel || !cur || !hist) return;

  const allItems = [];
  aiAlerts.forEach(a => allItems.push({ type: 'alert', cat: a.category || 'ALERT', sev: Number(a.severity || 2), text: a.summary || '', detail: a.recommended_action || '', geo: a.geo || null, ts: a.timestamp || null }));
  aiInsights.forEach(i => {
    const r = i.result || {};
    allItems.push({ type: 'insight', cat: (i.type || 'AI').toUpperCase(), sev: Number(r.alert_level || r.threat_level || 2), text: r.summary || '', detail: r.recommended_action || '', geo: r.geo || null, ts: r.timestamp || null });
  });

  const sig = `${allItems.length}|${allItems[0]?.text || ''}`;
  if (sig === _aiPanelSig) return;
  _aiPanelSig = sig;

  if (cnt) cnt.textContent = allItems.length ? `${allItems.length}` : '';

  if (!allItems.length) {
    cur.innerHTML = `<div style="color:var(--text2);font-size:12px">${_standalone ? 'טוען ניתוח מקומי...' : 'אין הודעות AI כרגע'}</div>`;
    hist.innerHTML = '';
    return;
  }

  const top = allItems[0];
  cur.innerHTML = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span class="${aiCatClass(top.sev)}">${escapeHtml(top.cat)}</span><span style="font-size:11px;color:var(--text2)">לחץ לפתוח היסטוריה</span></div><div style="font-size:14px;line-height:1.3">${escapeHtml(top.text)}</div>${top.detail ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${escapeHtml(top.detail)}</div>` : ''}`;

  hist.innerHTML = allItems.slice(1).map((item, idx) =>
    `<div class="ai-item" data-ai-idx="${idx + 1}"><span class="${aiCatClass(item.sev)}">${escapeHtml(item.cat)}</span> ${escapeHtml(item.text)}${item.detail ? `<div style="font-size:11px;color:var(--text2);margin-top:1px">${escapeHtml(item.detail)}</div>` : ''}</div>`
  ).join('');
}

function initEntityClick() {
  if (!viewer) return;
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const _pick = pos => {
    try {
      const picked = viewer.scene.pick(pos);
      if (Cesium.defined(picked) && picked.id?._rcData) showInfoPopup(picked.id._rcData, picked.id._rcType);
    } catch(_) {}
  };
  handler.setInputAction(click => _pick(click.position), Cesium.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(click => _pick(click.position), Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.CTRL);
}
function closePopup() { $('info-popup')?.classList.add('hidden'); }

function _compassSvg(deg) {
  const r = (deg || 0) * Math.PI / 180;
  return `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1"/><text x="18" y="8" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="6" font-family="Orbitron">N</text><line x1="18" y1="18" x2="${18 + 12 * Math.sin(r)}" y2="${18 - 12 * Math.cos(r)}" stroke="#00e5ff" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="18" r="2" fill="#00e5ff"/></svg>`;
}

function _gauge(lbl, val, unit, color, pct) {
  return `<div class="popup-gauge"><div class="pg-lbl">${lbl}</div><div class="pg-num" style="color:${color}">${val}</div><div class="pg-unit">${unit}</div><div class="popup-bar"><div class="popup-bar-fill" style="width:${Math.min(100, Math.max(2, pct || 0))}%;background:${color}"></div></div></div>`;
}

function _aiContext(type, d) {
  const items = [...aiAlerts, ...aiInsights.map(i => ({ summary: i.result?.summary, category: (i.type || '').toUpperCase(), severity: i.result?.alert_level, recommended_action: i.result?.recommended_action }))];
  const match = items.find(a => {
    const s = (a.summary || '').toLowerCase();
    if (type === 'earthquake' && d.place && s.includes((d.place || '').toLowerCase().slice(0, 15))) return true;
    if (type === 'aviation' && d.icao24 && s.includes(d.icao24)) return true;
    if (type === 'marine' && s.includes('גל')) return true;
    return false;
  });
  if (!match) return '';
  return `<div class="popup-ai"><b>AI \u05e0\u05d9\u05ea\u05d5\u05d7</b><br>${escapeHtml(match.summary || '')}${match.recommended_action ? `<br><span style="color:var(--cyan)">\u2192 ${escapeHtml(match.recommended_action)}</span>` : ''}</div>`;
}

function showInfoPopup(d, type) {
  try { _showInfoPopupInner(d, type); } catch(e) { console.warn('popup error:', e); }
}

function _showInfoPopupInner(d, type) {
  const el = $('info-popup');
  const content = $('info-popup-content');
  if (!el || !content || !d) return;
  el.classList.remove('hidden');
  el.scrollTop = 0;
  let html = '';

  if (type === 'earthquake') {
    const mag = Number(d.magnitude) || 0;
    const depth = Number(d.depth) || 0;
    const sev = mag >= 8 ? '\u05e7\u05d9\u05e6\u05d5\u05e0\u05d9' : mag >= 7 ? '\u05d7\u05de\u05d5\u05e8 \u05de\u05d0\u05d5\u05d3' : mag >= 6 ? '\u05d7\u05d6\u05e7' : mag >= 5 ? '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9' : mag >= 4 ? '\u05e7\u05dc' : '\u05de\u05d9\u05e0\u05d5\u05e8\u05d9';
    const sevCol = mag >= 6 ? '#ff1744' : mag >= 4.5 ? '#ff9100' : '#ffd600';
    const tsunami = mag >= 6.5 && depth < 70 ? '\u05d2\u05d1\u05d5\u05d4' : mag >= 6 ? '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9' : '\u05e0\u05de\u05d5\u05da';
    const tsuCol = tsunami === '\u05d2\u05d1\u05d5\u05d4' ? '#ff1744' : tsunami === '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9' ? '#ff9100' : '#00e676';
    const place = d.place || '\u05de\u05d9\u05e7\u05d5\u05dd \u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2';
    const lat = d.geo?.lat; const lon = d.geo?.lon;
    const distIL = lat != null && lon != null ? Math.round(Math.sqrt(Math.pow((lat - 31.77) * 111, 2) + Math.pow((lon - 35.21) * 85, 2))) : null;
    const eqPhotoId = 'eqPhoto_' + Date.now();
    const warnCls = mag >= 6 ? 'red' : mag >= 4.5 ? '' : 'green';
    const warnText = mag >= 6 ? '\u26a0 \u05e8\u05e2\u05d9\u05d3\u05d4 \u05d7\u05d6\u05e7\u05d4 \u2014 \u05e1\u05d9\u05db\u05d5\u05df \u05dc\u05e0\u05d6\u05e7 \u05de\u05d1\u05e0\u05d9' : mag >= 5 ? '\u26a0 \u05e8\u05e2\u05d9\u05d3\u05d4 \u05de\u05d5\u05e8\u05d2\u05e9\u05ea \u2014 \u05d9\u05e9 \u05dc\u05d4\u05d9\u05e9\u05d0\u05e8 \u05d1\u05db\u05d5\u05e0\u05e0\u05d5\u05ea' : mag >= 4 ? '\u26a0 \u05e8\u05e2\u05d9\u05d3\u05d4 \u05e7\u05dc\u05d4 \u2014 \u05de\u05d5\u05e8\u05d2\u05e9\u05ea \u05d1\u05e1\u05d1\u05d9\u05d1\u05d4' : '\u2705 \u05de\u05d9\u05e0\u05d5\u05e8\u05d9\u05ea \u2014 \u05dc\u05dc\u05d0 \u05e1\u05d9\u05db\u05d5\u05df \u05de\u05d9\u05d5\u05d7\u05d3';
    html = `<img id="${eqPhotoId}" class="popup-photo hidden" alt="" onerror="this.classList.add('hidden')" />`
      + `<div class="popup-header"><div class="popup-title" style="color:${sevCol}">M ${mag.toFixed(1)} \u2014 ${sev}</div><div class="popup-sub">\ud83d\udccd ${escapeHtml(place)}</div></div>`
      + `<div class="popup-gauges">`
      + _gauge('\u05e2\u05d5\u05e6\u05de\u05d4', mag.toFixed(1), 'Richter', sevCol, Math.min(100, mag * 10))
      + _gauge('\u05e2\u05d5\u05de\u05e7', depth ? Math.round(depth) : '?', 'km', '#4fc3f7', Math.min(100, depth / 7))
      + _gauge('\u05e6\u05d5\u05e0\u05d0\u05de\u05d9', tsunami, '', tsuCol, tsunami === '\u05d2\u05d1\u05d5\u05d4' ? 90 : tsunami === '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9' ? 50 : 10)
      + `</div>`
      + `<div class="popup-warn ${warnCls}">${warnText}</div>`
      + `<div style="margin-top:10px">`
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udd52</span><span class="pr-label">\u05d6\u05de\u05df</span><span class="pr-val">${d.time ? new Date(d.time).toLocaleString('he-IL') : '?'}</span></div>`
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udccd</span><span class="pr-label">\u05de\u05d9\u05e7\u05d5\u05dd</span><span class="pr-val">${lat != null ? lat.toFixed(3) : '?'}\u00b0 / ${lon != null ? lon.toFixed(3) : '?'}\u00b0</span></div>`
      + (distIL != null ? `<div class="popup-row"><span class="pr-icon">\ud83c\uddee\ud83c\uddf1</span><span class="pr-label">\u05de\u05d9\u05e9\u05e8\u05d0\u05dc</span><span class="pr-val" style="color:${distIL < 300 ? '#ff1744' : distIL < 800 ? '#ff9100' : 'var(--text)'}">${distIL} km</span></div>` : '')
      + `<div class="popup-row"><span class="pr-icon">\ud83c\udf0a</span><span class="pr-label">\u05e6\u05d5\u05e0\u05d0\u05de\u05d9</span><span class="pr-val" style="color:${tsuCol}">${tsunami}</span></div>`
      + `</div>`
      + `<div class="popup-note">\u05e8\u05d9\u05db\u05d8\u05e8: 4.0+ \u05de\u05d5\u05e8\u05d2\u05e9 | 5.0+ \u05e1\u05d9\u05db\u05d5\u05df \u05de\u05d1\u05e0\u05d9 | 6.5+ \u05e4\u05d5\u05d8\u05e0\u05e6\u05d9\u05d0\u05dc \u05e6\u05d5\u05e0\u05d0\u05de\u05d9 \u05d0\u05dd \u05e8\u05d3\u05d5\u05d3.</div>`
      + _aiContext('earthquake', d);
    const cityMatch = (place || '').match(/of\s+(.+?)(?:,|$)/i);
    if (cityMatch) {
      const cityName = cityMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      setTimeout(() => {
        const img = document.getElementById(eqPhotoId);
        if (!img) return;
        img.src = `https://source.unsplash.com/600x200/?${encodeURIComponent(cityMatch[1].trim())},city,landscape`;
        img.onload = () => img.classList.remove('hidden');
      }, 80);
    }

  } else if (type === 'aviation') {
    const alt = Math.round(d.altitude || d.geo?.alt || 0);
    const spd = d.velocity != null ? Math.round(d.velocity) : null;
    const spdKmh = spd != null ? Math.round(spd * 3.6) : null;
    const hdg = d.heading != null ? Math.round(d.heading) : null;
    const isMil = d.isMilitary || _classifyAircraft(d.icao24, d.callsign, d.country, d.category).mil;
    const cls = d.milLabel || _classifyAircraft(d.icao24, d.callsign, d.country, d.category).label;
    const col = isMil ? '#ff1744' : '#ffd600';
    const tr = _milTracker.get(d.icao24);
    const trackMin = tr ? Math.round((Date.now() - tr.firstSeen) / 60000) : 0;
    const photoId = `acPhoto_${d.icao24}`;
    const vrIcon = d.verticalRate > 2 ? '\u2197\ufe0f' : d.verticalRate < -2 ? '\u2198\ufe0f' : '\u27a1\ufe0f';
    const vrCol = d.verticalRate > 2 ? '#00e676' : d.verticalRate < -2 ? '#ff9100' : 'var(--text)';

    html = `<img id="${photoId}" class="popup-photo hidden" alt="" onerror="this.classList.add('hidden')" />`
      + `<div class="popup-header"><div class="popup-title" style="color:${col}">\u2708\ufe0f ${escapeHtml(d.callsign || d.icao24 || 'AIRCRAFT')}</div>`
      + `<div class="popup-sub">${escapeHtml(d.country || '')}</div></div>`
      + (isMil ? `<div style="text-align:center"><span class="popup-mil-badge">\u26a0 ${escapeHtml(cls)}</span></div>` : '')
      + `<div class="popup-gauges">`
      + _gauge('\u05d2\u05d5\u05d1\u05d4', alt > 0 ? (alt > 9999 ? (alt/1000).toFixed(1) : alt) : '?', alt > 9999 ? 'km' : 'm', '#4fc3f7', Math.min(100, alt / 150))
      + (spdKmh != null ? _gauge('\u05de\u05d4\u05d9\u05e8\u05d5\u05ea', spdKmh, 'km/h', '#ffd600', Math.min(100, spdKmh / 10)) : '')
      + (hdg != null ? `<div class="popup-gauge"><div class="pg-lbl">\u05db\u05d9\u05d5\u05d5\u05df</div><div class="popup-compass">${_compassSvg(hdg)}</div><div class="pg-num" style="color:#00e5ff;font-size:13px">${hdg}\u00b0</div></div>` : '')
      + `</div>`
      + `<div style="margin-top:6px">`
      + `<div class="popup-row"><span class="pr-icon">\ud83c\udd94</span><span class="pr-label">ICAO</span><span class="pr-val" style="font-family:Orbitron;letter-spacing:1px;font-size:12px">${d.icao24 || '?'}</span></div>`
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udce1</span><span class="pr-label">Callsign</span><span class="pr-val">${d.callsign || '---'}</span></div>`
      + (d.squawk ? `<div class="popup-row"><span class="pr-icon">\ud83d\udea8</span><span class="pr-label">Squawk</span><span class="pr-val" style="color:${d.squawk === '7700' ? '#ff1744' : d.squawk === '7600' ? '#ff9100' : 'inherit'}">${d.squawk}${d.squawk === '7700' ? ' EMERGENCY' : d.squawk === '7600' ? ' COMMS LOST' : ''}</span></div>` : '')
      + (d.verticalRate != null ? `<div class="popup-row"><span class="pr-icon">${vrIcon}</span><span class="pr-label">\u05d0\u05e0\u05db\u05d9</span><span class="pr-val" style="color:${vrCol}">${d.verticalRate > 0 ? '+' : ''}${d.verticalRate.toFixed(1)} m/s</span></div>` : '')
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udccd</span><span class="pr-label">\u05de\u05d9\u05e7\u05d5\u05dd</span><span class="pr-val">${d.geo?.lat?.toFixed(3) || '?'}, ${d.geo?.lon?.toFixed(3) || '?'}</span></div>`
      + (tr ? `<div class="popup-row"><span class="pr-icon">\u23f1\ufe0f</span><span class="pr-label">\u05de\u05e2\u05e7\u05d1</span><span class="pr-val">${trackMin} \u05d3\u05e7\u05d5\u05ea | ${tr.trail?.length || 0} \u05e0\u05e7\u05d5\u05d3\u05d5\u05ea</span></div>` : '')
      + `</div>`
      + _aiContext('aviation', d);

    if (d.icao24) {
      setTimeout(() => {
        const img = document.getElementById(photoId);
        if (!img) return;
        fetch(`https://api.planespotters.net/pub/photos/hex/${d.icao24}`, { signal: AbortSignal.timeout(5000) })
          .then(r => r.json()).then(j => {
            const photo = j?.photos?.[0]?.thumbnail_large?.src || j?.photos?.[0]?.thumbnail?.src;
            if (photo && img) { img.src = photo; img.classList.remove('hidden'); }
          }).catch(() => {});
      }, 100);
    }

  } else if (type === 'weather') {
    const t = Number(d.temperature) || 0; const w = Number(d.windspeed) || 0;
    const col = t > 40 ? '#ff1744' : t > 30 ? '#ff9100' : t > 20 ? '#ffd600' : t > 10 ? '#00e5ff' : '#2196f3';
    const wIcon = w > 60 ? '\ud83c\udf2a\ufe0f' : w > 30 ? '\ud83d\udca8' : '\ud83c\udf43';
    const tIcon = t > 35 ? '\ud83d\udd25' : t > 25 ? '\u2600\ufe0f' : t > 15 ? '\u26c5' : t > 5 ? '\ud83c\udf25\ufe0f' : '\u2744\ufe0f';
    const city = d.city || '';
    const wxPhotoId = 'wxPhoto_' + Date.now();
    html = `<img id="${wxPhotoId}" class="popup-photo hidden" alt="" onerror="this.classList.add('hidden')" />`
      + `<div class="popup-header"><div class="popup-title" style="color:${col}">${tIcon} ${Math.round(t)}\u00b0C</div><div class="popup-sub">${escapeHtml(city || '\u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2')}</div></div>`
      + `<div class="popup-gauges">`
      + _gauge('\u05d8\u05de\u05e4\u05f3', Math.round(t), '\u00b0C', col, Math.min(100, ((t + 20) / 70) * 100))
      + _gauge('\u05e8\u05d5\u05d7', Math.round(w), 'km/h', w > 60 ? '#ff1744' : w > 30 ? '#ff9100' : '#00e5ff', Math.min(100, w / 1.2))
      + (d.humidity != null ? _gauge('\u05dc\u05d7\u05d5\u05ea', Math.round(d.humidity), '%', '#7c4dff', d.humidity) : '')
      + `</div>`
      + `<div style="margin-top:6px">`
      + `<div class="popup-row"><span class="pr-icon">\ud83c\udf21\ufe0f</span><span class="pr-label">\u05d8\u05de\u05e4\u05f3</span><span class="pr-val" style="color:${col}">${t}\u00b0C</span></div>`
      + `<div class="popup-row"><span class="pr-icon">${wIcon}</span><span class="pr-label">\u05e8\u05d5\u05d7</span><span class="pr-val">${Math.round(w)} km/h</span></div>`
      + (d.humidity != null ? `<div class="popup-row"><span class="pr-icon">\ud83d\udca7</span><span class="pr-label">\u05dc\u05d7\u05d5\u05ea</span><span class="pr-val">${Math.round(d.humidity)}%</span></div>` : '')
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udccd</span><span class="pr-label">\u05de\u05d9\u05e7\u05d5\u05dd</span><span class="pr-val">${d.geo?.lat?.toFixed(2) || '?'}, ${d.geo?.lon?.toFixed(2) || '?'}</span></div>`
      + `</div>`
      + (w > 50 ? `<div class="popup-warn red">\ud83c\udf2a\ufe0f \u05e8\u05d5\u05d7\u05d5\u05ea \u05d7\u05d6\u05e7\u05d5\u05ea \u2014 \u05d9\u05e9 \u05dc\u05d4\u05d9\u05d6\u05d4\u05e8!</div>` : w > 30 ? `<div class="popup-warn">\ud83d\udca8 \u05e8\u05d5\u05d7 \u05e2\u05d6 \u2014 \u05d4\u05d9\u05e9\u05de\u05e8\u05d5 \u05de\u05e2\u05e6\u05de\u05d9\u05dd \u05de\u05e2\u05d5\u05e4\u05e4\u05d9\u05dd</div>` : '')
      + (t > 40 ? `<div class="popup-warn red">\ud83d\udd25 \u05d7\u05d5\u05dd \u05e7\u05d9\u05e6\u05d5\u05e0\u05d9 \u2014 \u05e1\u05db\u05e0\u05ea \u05de\u05db\u05ea \u05d7\u05d5\u05dd!</div>` : '');
    if (city) {
      setTimeout(() => {
        const img = document.getElementById(wxPhotoId);
        if (!img) return;
        img.src = `https://source.unsplash.com/600x200/?${encodeURIComponent(city)},city,skyline`;
        img.onload = () => img.classList.remove('hidden');
      }, 80);
    }

  } else if (type === 'marine') {
    const wh = parseFloat(d.waveHeight) || 0;
    const col = wh > 5 ? '#ff1744' : wh > 3 ? '#ff9100' : wh > 1.5 ? '#ffd600' : '#00bcd4';
    const seaState = wh > 6 ? '\u05e1\u05d5\u05e2\u05e8' : wh > 4 ? '\u05e1\u05d5\u05e2\u05e8 \u05de\u05d0\u05d5\u05d3' : wh > 2.5 ? '\u05dc\u05d0 \u05e8\u05d2\u05d5\u05e2' : wh > 1 ? '\u05e8\u05d2\u05d5\u05e2 \u05d9\u05d7\u05e1\u05d9\u05ea' : '\u05e8\u05d2\u05d5\u05e2';
    const seaDot = wh > 4 ? '#ff1744' : wh > 2 ? '#ff9100' : '#00e676';
    html = `<div class="popup-header"><div class="popup-title" style="color:${col}"><span class="wave-icon">\ud83c\udf0a</span> ${wh.toFixed(1)}m</div><div class="popup-sub">${escapeHtml(d.station || '\u05ea\u05d7\u05e0\u05d4 \u05d9\u05de\u05d9\u05ea')}</div></div>`
      + `<div class="popup-status"><span class="dot" style="background:${seaDot}"></span> \u05de\u05e6\u05d1 \u05d9\u05dd: <b style="color:${col};margin-right:4px">${seaState}</b></div>`
      + `<div class="popup-gauges">`
      + _gauge('\u05d2\u05dc\u05d9\u05dd', wh.toFixed(1), 'm', col, Math.min(100, wh * 10))
      + (d.waterTemp ? _gauge('\u05de\u05d9\u05dd', d.waterTemp, '\u00b0C', '#00bcd4', Math.min(100, d.waterTemp * 3)) : '')
      + (d.tide != null ? _gauge('\u05d2\u05d0\u05d5\u05ea', parseFloat(d.tide).toFixed(1), 'm', '#7c4dff', 50 + parseFloat(d.tide) * 25) : '')
      + `</div>`
      + `<div style="margin-top:6px">`
      + `<div class="popup-row"><span class="pr-icon"><span class="wave-icon">\ud83c\udf0a</span></span><span class="pr-label">\u05d2\u05d5\u05d1\u05d4</span><span class="pr-val" style="color:${col}">${wh.toFixed(1)} m</span></div>`
      + (d.waterTemp ? `<div class="popup-row"><span class="pr-icon">\ud83c\udf21\ufe0f</span><span class="pr-label">\u05d8\u05de\u05e4\u05f3 \u05d9\u05dd</span><span class="pr-val">${d.waterTemp}\u00b0C</span></div>` : '')
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udccd</span><span class="pr-label">\u05de\u05d9\u05e7\u05d5\u05dd</span><span class="pr-val">${d.geo?.lat?.toFixed(2) || '?'}, ${d.geo?.lon?.toFixed(2) || '?'}</span></div>`
      + `</div>`
      + (wh > 4 ? `<div class="popup-warn red">\u26a0 \u05d0\u05d6\u05d4\u05e8\u05ea \u05d9\u05dd \u05db\u05dc\u05dc\u05d9\u05ea \u2014 \u05d2\u05dc\u05d9\u05dd \u05de\u05e2\u05dc 4m!</div>` : wh > 2 ? `<div class="popup-warn">\u26a0 \u05e1\u05db\u05e0\u05d4 \u05dc\u05e9\u05d9\u05d9\u05d8 \u05e7\u05d8\u05df \u2014 \u05d2\u05dc\u05d9\u05dd \u05de\u05e2\u05dc 2m</div>` : `<div class="popup-warn green">\u2705 \u05d9\u05dd \u05e8\u05d2\u05d5\u05e2 \u2014 \u05d1\u05d8\u05d5\u05d7 \u05dc\u05e9\u05d9\u05d9\u05d8 \u05d5\u05e8\u05d7\u05e6\u05d4</div>`)
      + `<div class="popup-note">\ud83d\udea2 \u05de\u05e2\u05dc 2m: \u05e1\u05db\u05e0\u05d4 \u05dc\u05e9\u05d9\u05d9\u05d8 \u05e7\u05d8\u05df | \ud83d\udea8 \u05de\u05e2\u05dc 4m: \u05d0\u05d6\u05d4\u05e8\u05d4 \u05d9\u05de\u05d9\u05ea | \ud83c\udf2a\ufe0f \u05de\u05e2\u05dc 6m: \u05e1\u05d5\u05e4\u05d4 \u05d9\u05de\u05d9\u05ea</div>`
      + _aiContext('marine', d);

  } else if (type === 'satellite' || type === 'iss') {
    const isISS = type === 'iss' || /ISS|ZARYA|25544/i.test(d.name || '');
    const col = isISS ? '#7c4dff' : '#4fc3f7';
    html = `<div class="popup-header"><div class="popup-title" style="color:${col}">${isISS ? '\ud83d\udef0\ufe0f ISS' : '\u25c8 ' + escapeHtml(d.name || 'SAT')}</div></div>`
      + `<div class="popup-gauges">`
      + (d.altitude ? _gauge('\u05d2\u05d5\u05d1\u05d4', Math.round(d.altitude), 'km', col, Math.min(100, d.altitude / 5)) : '')
      + (d.meanMotion ? _gauge('\u05e1\u05d9\u05d1\u05d5\u05d1/\u05d9\u05d5\u05dd', parseFloat(d.meanMotion).toFixed(1), '', col, parseFloat(d.meanMotion) * 6) : '')
      + (d.inclination ? _gauge('\u05d4\u05d8\u05d9\u05d4', d.inclination, '\u00b0', col, d.inclination / 1.8) : '')
      + `</div>`
      + `<div style="margin-top:6px">`
      + (d.noradId ? `<div class="popup-row"><span class="pr-icon">\ud83d\udee0\ufe0f</span><span class="pr-label">NORAD</span><span class="pr-val" style="font-family:Orbitron;font-size:12px">${d.noradId}</span></div>` : '')
      + (d.geo ? `<div class="popup-row"><span class="pr-icon">\ud83d\udccd</span><span class="pr-label">\u05de\u05d9\u05e7\u05d5\u05dd</span><span class="pr-val">${d.geo.lat?.toFixed(2) || '?'}\u00b0, ${d.geo.lon?.toFixed(2) || '?'}\u00b0</span></div>` : '')
      + `</div>`;

  } else if (type === 'ships') {
    const st = d.shipType || 0;
    const stName = d.shipTypeName || _shipTypeName(st);
    const stIcon = st >= 70 && st <= 79 ? '\ud83d\udea2' : st >= 60 && st <= 69 ? '\u26f4\ufe0f' : st >= 80 && st <= 89 ? '\u26fd' : st === 35 ? '\u2694\ufe0f' : st >= 30 && st <= 39 ? '\u2693' : '\ud83d\udea4';
    const navCol = d.navStatus === '\u05e2\u05d5\u05d2\u05e0\u05ea' ? '#ff9100' : d.navStatus === '\u05e2\u05dc \u05e9\u05e8\u05d8\u05d5\u05df' ? '#ff1744' : '#00e676';
    const spdKn = d.speed != null ? d.speed.toFixed(1) : null;
    const spdKmh = d.speed != null ? (d.speed * 1.852).toFixed(0) : null;
    html = `<div class="popup-header"><div class="popup-title" style="color:#00bfa5">${stIcon} ${escapeHtml(d.name || 'VESSEL')}</div><div class="popup-sub">${escapeHtml(stName)}${d.source === 'digitraffic' ? ' \ud83d\udfe2 AIS' : ''}</div></div>`
      + (d.navStatus ? `<div class="popup-status"><span class="dot" style="background:${navCol}"></span> ${escapeHtml(d.navStatus)}</div>` : '')
      + `<div class="popup-gauges">`
      + (spdKn != null ? _gauge('\u05de\u05d4\u05d9\u05e8\u05d5\u05ea', spdKn, `kn (${spdKmh} km/h)`, '#00e5ff', Math.min(100, d.speed * 4)) : '')
      + (d.heading != null ? `<div class="popup-gauge"><div class="pg-lbl">\u05db\u05d9\u05d5\u05d5\u05df</div><div class="popup-compass">${_compassSvg(d.heading)}</div><div class="pg-num" style="color:#00e5ff;font-size:13px">${Math.round(d.heading)}\u00b0</div></div>` : '')
      + (d.draught != null ? _gauge('\u05e9\u05d5\u05e7\u05e2', d.draught.toFixed(1), 'm', '#7c4dff', Math.min(100, d.draught * 5)) : '')
      + `</div>`
      + `<div style="margin-top:6px">`
      + (d.mmsi ? `<div class="popup-row"><span class="pr-icon">\ud83d\udee0\ufe0f</span><span class="pr-label">MMSI</span><span class="pr-val" style="font-family:Orbitron;font-size:12px">${d.mmsi}</span></div>` : '')
      + (d.imo ? `<div class="popup-row"><span class="pr-icon">\ud83c\udd94</span><span class="pr-label">IMO</span><span class="pr-val" style="font-family:Orbitron;font-size:12px">${d.imo}</span></div>` : '')
      + (d.callSign ? `<div class="popup-row"><span class="pr-icon">\ud83d\udce1</span><span class="pr-label">Callsign</span><span class="pr-val">${escapeHtml(d.callSign)}</span></div>` : '')
      + (d.destination ? `<div class="popup-row"><span class="pr-icon">\ud83c\udfc1</span><span class="pr-label">\u05d9\u05e2\u05d3</span><span class="pr-val" style="color:#00e5ff">${escapeHtml(d.destination)}</span></div>` : '')
      + (d.shipType ? `<div class="popup-row"><span class="pr-icon">\u2693</span><span class="pr-label">\u05e1\u05d5\u05d2</span><span class="pr-val">${escapeHtml(stName)} (AIS ${d.shipType})</span></div>` : '')
      + `<div class="popup-row"><span class="pr-icon">\ud83d\udccd</span><span class="pr-label">\u05de\u05d9\u05e7\u05d5\u05dd</span><span class="pr-val">${d.geo?.lat?.toFixed(4) || '?'}, ${d.geo?.lon?.toFixed(4) || '?'}</span></div>`
      + (d.timestamp ? `<div class="popup-row"><span class="pr-icon">\ud83d\udd52</span><span class="pr-label">\u05e2\u05d3\u05db\u05d5\u05df</span><span class="pr-val">${new Date(d.timestamp).toLocaleString('he-IL')}</span></div>` : '')
      + `</div>`
      + (st === 35 ? `<div class="popup-warn red">\u2694\ufe0f \u05db\u05dc\u05d9 \u05e9\u05d9\u05d9\u05d8 \u05e6\u05d1\u05d0\u05d9</div>` : '');

  } else if (d._isAlert) {
    const col = (d.severity || 0) >= 4 ? '#ff1744' : (d.severity || 0) >= 3 ? '#ff9100' : '#ffd600';
    html = `<div class="popup-header"><div class="popup-title" style="color:${col}">\u26a1 \u05e8\u05de\u05d4 ${d.severity || '?'}</div><div class="popup-sub">${escapeHtml(d.category || '\u05de\u05e2\u05e8\u05db\u05ea')}</div></div>`
      + `<div style="font-size:14px;line-height:1.5;margin-bottom:8px">${escapeHtml(d.summary || '')}</div>`
      + (d.recommended_action ? `<div style="color:var(--cyan);font-size:13px">\u2192 ${escapeHtml(d.recommended_action)}</div>` : '')
      + (d.confidence ? `<div style="margin-top:6px;font-size:11px;color:var(--text2)">\u05d1\u05d9\u05d8\u05d7\u05d5\u05df: ${((d.confidence || 0) * 100).toFixed(0)}%</div>` : '');

  } else {
    html = `<div style="font-size:13px;line-height:1.4;word-break:break-all"><pre style="white-space:pre-wrap;margin:0;color:var(--text2)">${escapeHtml(JSON.stringify(d, null, 2))}</pre></div>`;
  }
  content.innerHTML = html;
}

function refreshComposite() {
  renderHazardsPanel();
  renderTrafficLayer();
  renderSatellitesLayer();
  renderGlobalHazardMarks();
  updateDepthReadout();
  detectAnomalies();
  if (_standalone && window.localAnalysis) {
    window.localAnalysis.run(live);
    window.localAnalysis.feed(pushAiAlert);
  }
  renderAiPanel();
}

function absorbAllData(all) {
  if (!all || typeof all !== 'object') return;
  if (all.earthquake) live.earthquake = all.earthquake;
  if (all.weather) live.weather = all.weather;
  if (all.marine) live.marine = all.marine;
  if (all.space_weather) live.space_weather = all.space_weather;
  if (all.satellites) live.satellites = all.satellites;
  if (all.aviation) live.aviation = all.aviation;
  if (all.ships) live.ships = all.ships;
  if (all.iss) live.iss = all.iss;
  if (all.israel_alerts) handleIsraelAlerts(all.israel_alerts).catch(() => {});
}

function renderAreas(allAreas, isPre = false, isClear = false, isShelter = false) {
  const box = $('areas');
  if (!box) return;
  const areas = filterAreas(allAreas || []);
  const totalCount = (allAreas || []).length;
  const countEl = $('alertCount');
  if (countEl) countEl.textContent = _watchEnabled && _watchlist.size ? `${areas.length}/${totalCount}` : `${totalCount}`;
  if (!areas.length) {
    box.innerHTML = totalCount
      ? `<div style="color:rgba(159,179,209,.8);padding:10px 0">${totalCount} התרעות (מסוננות ע"י רשימת מעקב)</div>`
      : '<div style="color:rgba(159,179,209,.8);padding:10px 0">אין התרעות פעילות כרגע</div>';
    return;
  }
  const pillClass = isClear ? 'green' : ((isPre || isShelter) ? 'amber' : 'red');
  const pillText = isClear ? 'CLEAR' : (isShelter ? '🛡 SHELTER' : (isPre ? 'PRE' : 'RED'));
  const migunCol = isClear ? '✅' : (isShelter ? '⏳' : '---');
  box.innerHTML = areas.map((a, i) => (
    `<div class="area" data-area-idx="${i}" style="cursor:pointer"><span class="pill ${pillClass}">${pillText}</span><span class="areaName">${escapeHtml(a)}</span><span class="pill" id="migun-${i}" style="margin-right:auto">${migunCol}</span></div>`
  )).join('');
}

function renderWatchlistUI() {
  const box = $('wlList');
  const toggle = $('wlToggle');
  if (toggle) {
    toggle.textContent = _watchEnabled ? 'ON' : 'OFF';
    toggle.classList.toggle('active', _watchEnabled);
  }
  const badge = $('wlBadge');
  if (badge) badge.textContent = _watchlist.size ? `${_watchlist.size}` : '';
  if (!box) return;
  if (!_watchlist.size) {
    box.innerHTML = '<div style="color:var(--text2);font-size:12px;padding:4px 0">רשימה ריקה - כל האזורים יוצגו</div>';
    return;
  }
  box.innerHTML = [..._watchlist].sort((a,b) => a.localeCompare(b,'he')).map(a =>
    `<div class="area" style="padding:3px 0"><span class="areaName" style="font-size:13px">${escapeHtml(a)}</span><button class="btn wl-rm" data-wl="${escapeHtml(a)}" style="margin-right:auto;padding:2px 8px;font-size:9px;color:var(--red);border-color:rgba(255,23,68,.3)">X</button></div>`
  ).join('');
}

function addToWatchlist(area) {
  if (!area) return;
  _watchlist.add(area);
  saveWatchlist();
  renderWatchlistUI();
  if (currentIsraelAlert?.active) renderAreas(currentIsraelAlert.areas || [], Number(currentIsraelAlert.category) === 14);
}

function removeFromWatchlist(area) {
  _watchlist.delete(area);
  saveWatchlist();
  renderWatchlistUI();
  if (currentIsraelAlert?.active) renderAreas(currentIsraelAlert.areas || [], Number(currentIsraelAlert.category) === 14);
}

function toggleWatchlist() {
  _watchEnabled = !_watchEnabled;
  saveWatchlist();
  renderWatchlistUI();
  if (currentIsraelAlert?.active) {
    handleIsraelAlerts(currentIsraelAlert).catch(() => {});
  }
}

function populateWlSuggestions(query) {
  const dl = $('wlSuggestions');
  if (!dl) return;
  dl.innerHTML = '';
  if (!query || query.length < 1) return;
  const q = query.trim().toLowerCase();
  const matches = _allKnownAreas.filter(a => a.toLowerCase().includes(q) && !_watchlist.has(a)).slice(0, 15);
  matches.forEach(a => { const o = document.createElement('option'); o.value = a; dl.appendChild(o); });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] || c));
}

function _formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m} \u05d3\u05e7\u05d5\u05ea \u05d5-${s} \u05e9\u05e0\u05d9\u05d5\u05ea`;
  return `${s} \u05e9\u05e0\u05d9\u05d5\u05ea`;
}

function _showExitClear() {
  const endTime = Date.now();
  const startTime = _alertStartTime || endTime;
  const durationMs = endTime - startTime;
  const startStr = new Date(startTime).toLocaleTimeString('he-IL');
  const endStr = new Date(endTime).toLocaleTimeString('he-IL');
  const durStr = _formatDuration(durationMs);
  const areasStr = _lastActiveAreas.slice(0, 8).join(', ') + (_lastActiveAreas.length > 8 ? ` (+${_lastActiveAreas.length - 8})` : '');

  const head = document.querySelector('#alertHead b');
  const instr = $('instructions');
  if (head) { head.textContent = '\u2705 \u05e0\u05d9\u05ea\u05df \u05dc\u05e6\u05d0\u05ea \u05de\u05d4\u05de\u05e8\u05d7\u05d1 \u05d4\u05de\u05d5\u05d2\u05df'; head.style.color = '#00e676'; }
  if (instr) instr.textContent = `\u05d4\u05d0\u05d9\u05e8\u05d5\u05e2 \u05d4\u05e1\u05ea\u05d9\u05d9\u05dd | \u05d4\u05ea\u05d7\u05dc\u05d4: ${startStr} | \u05e1\u05d9\u05d5\u05dd: ${endStr} | \u05de\u05e9\u05da: ${durStr}`;

  const toastTitle = $('toastTitle');
  if (toastTitle) { toastTitle.textContent = '\u2705 \u05d4\u05d0\u05d9\u05e8\u05d5\u05e2 \u05d4\u05e1\u05ea\u05d9\u05d9\u05dd'; toastTitle.style.color = '#00e676'; }
  const toastInner = $('toastInner');
  if (toastInner) {
    toastInner.style.borderColor = 'rgba(0,230,118,.55)';
    toastInner.style.background = 'rgba(0,230,118,.12)';
    toastInner.style.boxShadow = '0 0 32px rgba(0,230,118,.14)';
  }
  const toastHtml = `<div style="margin-bottom:6px;font-size:17px;color:#00e676;font-weight:700">\u2705 \u05e0\u05d9\u05ea\u05df \u05dc\u05e6\u05d0\u05ea \u05de\u05d4\u05de\u05e8\u05d7\u05d1 \u05d4\u05de\u05d5\u05d2\u05df</div>`
    + `<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px;line-height:1.5">`
    + `<span style="color:var(--text2)">\u05d4\u05ea\u05d7\u05dc\u05d4</span><span style="color:#fff;font-family:Orbitron;font-size:13px">${startStr}</span>`
    + `<span style="color:var(--text2)">\u05e1\u05d9\u05d5\u05dd</span><span style="color:#00e676;font-family:Orbitron;font-size:13px">${endStr}</span>`
    + `<span style="color:var(--text2)">\u05de\u05e9\u05da \u05d1\u05de\u05e8\u05d7\u05d1 \u05de\u05d5\u05d2\u05df</span><span style="color:#fff;font-weight:700">${durStr}</span>`
    + (areasStr ? `<span style="color:var(--text2)">\u05d0\u05d6\u05d5\u05e8\u05d9\u05dd</span><span style="color:var(--text2);font-size:13px">${escapeHtml(areasStr)}</span>` : '')
    + `</div>`;
  showToast(toastHtml, 12000, true);
  window.soundSystem?.alertInfo();

  const popup = $('info-popup');
  const popContent = $('info-popup-content');
  if (popup && popContent) {
    popContent.innerHTML = `<div style="text-align:center;margin-bottom:14px">`
      + `<div style="font-family:Orbitron;font-size:28px;font-weight:900;color:#00e676;margin-bottom:6px">\u2705 \u05d4\u05d0\u05d9\u05e8\u05d5\u05e2 \u05d4\u05e1\u05ea\u05d9\u05d9\u05dd</div>`
      + `<div style="font-size:16px;color:var(--text2)">\u05e0\u05d9\u05ea\u05df \u05dc\u05e6\u05d0\u05ea \u05de\u05d4\u05de\u05e8\u05d7\u05d1 \u05d4\u05de\u05d5\u05d2\u05df</div></div>`
      + `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;margin-bottom:16px">`
      + `<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 8px"><div style="font-size:11px;color:var(--text2);font-family:Orbitron;letter-spacing:1px">\u05d4\u05ea\u05d7\u05dc\u05d4</div><div style="font-family:Orbitron;font-size:18px;color:#ff9100;margin-top:4px">${startStr}</div></div>`
      + `<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 8px"><div style="font-size:11px;color:var(--text2);font-family:Orbitron;letter-spacing:1px">\u05e1\u05d9\u05d5\u05dd</div><div style="font-family:Orbitron;font-size:18px;color:#00e676;margin-top:4px">${endStr}</div></div>`
      + `<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 8px"><div style="font-size:11px;color:var(--text2);font-family:Orbitron;letter-spacing:1px">\u05de\u05e9\u05da</div><div style="font-family:Orbitron;font-size:18px;color:#fff;margin-top:4px">${durStr}</div></div>`
      + `</div>`
      + (_lastActiveAreas.length ? `<div style="border-top:1px solid rgba(0,230,118,.2);padding-top:10px;font-size:14px;color:var(--text2);line-height:1.6"><b style="color:#00e676">\u05d0\u05d6\u05d5\u05e8\u05d9\u05dd:</b> ${escapeHtml(_lastActiveAreas.join(', '))}</div>` : '');
    popup.style.borderColor = 'rgba(0,230,118,.45)';
    popup.style.boxShadow = '0 0 48px rgba(0,230,118,.15), 0 0 120px rgba(0,0,0,.5)';
    popup.classList.remove('hidden');
    setTimeout(() => { popup.classList.add('hidden'); popup.style.borderColor = ''; popup.style.boxShadow = ''; }, 30000);
  }

  clearPulses();
  renderAreas(_lastActiveAreas, false, true);
  _lastActiveAreas.forEach(async (a) => {
    const geo = await getAreaGeo(a);
    if (geo) addPulseAt(geo.lon, geo.lat, '#00e676', a, true);
  });
  renderHazardsPanel();
  setTimeout(() => {
    clearPulses(); renderAreas([]); _lastActiveAreas = []; _alertStartTime = 0;
    const h = document.querySelector('#alertHead b');
    const ins = $('instructions');
    if (h) { h.textContent = '\u05e6\u05d1\u05e2 \u05d0\u05d3\u05d5\u05dd - \u05d9\u05e9\u05e8\u05d0\u05dc'; h.style.color = 'var(--red)'; }
    if (ins) ins.textContent = '';
  }, 300000);
}

const _MIN_SHELTER_MS = 600000;

async function handleIsraelAlerts(d) {
  if (!$('alertTime')) return;

  if (d?.source === 'tzevaadom' && Date.now() < _preferOrefUntil) { _log('Alert', 'Skipping tzevaadom (oref preferred)'); return; }

  _log('Alert', `handleIsraelAlerts: active=${d?.active} id=${d?.id||'?'} isPre=${Number(d?.category)===14} isExit=${!!d?.isExit} areas=${d?.areas?.length||0} src=${d?.source||'?'}`);
  currentIsraelAlert = d || null;

  $('alertTime').textContent = d?.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '---';

  const instr = $('instructions');
  if (instr) {
    const parts = [];
    if (d?.desc) parts.push(String(d.desc));
    if (d?.duration !== undefined && d?.duration !== null && !Number.isNaN(Number(d.duration))) {
      const mins = Math.round(Number(d.duration) / 60);
      parts.push(`שהייה במרחב מוגן: ${mins} דקות`);
    }
    instr.textContent = parts.join(' | ');
  }

  if (!d?.active) {
    const hadActive = lastAlertId && _lastActiveAreas.length > 0;
    lastAlertId = '';
    currentIsraelAlert = { ...(d || {}), active: false };
    clearPulses();
    if (d?.source === 'oref') _preferOrefUntil = 0;
    const head = document.querySelector('#alertHead b');
    if (d?.isExit) {
      if (d.areas?.length) _lastActiveAreas = [...new Set([..._lastActiveAreas, ...d.areas])];
      if (_migunTimeoutId) { clearTimeout(_migunTimeoutId); _migunTimeoutId = null; }
      if (_migunCountdownId) { clearInterval(_migunCountdownId); _migunCountdownId = null; }
      if (!_lastAlertWasPre) {
        _log('Alert', `Exit notification from system → immediate release (elapsed ${_alertStartTime ? Math.round((Date.now()-_alertStartTime)/1000) : '?'}s)`);
        _showExitClear();
      } else { clearPulses(); renderAreas([]); _lastActiveAreas = []; _alertStartTime = 0; _lastAlertWasPre = false; _log('Alert', 'Exit after pre-alert, silent clear'); }
    } else if (hadActive && !_lastAlertWasPre) {
      let maxMigunMs = 0;
      try {
        const meta = await loadAreaMeta();
        for (const a of _lastActiveAreas) {
          const s = meta.migun.get(a);
          if (s !== undefined && s * 1000 > maxMigunMs) maxMigunMs = s * 1000;
        }
      } catch(_) {}
      if (!maxMigunMs) maxMigunMs = 90000;
      maxMigunMs = Math.max(maxMigunMs, _MIN_SHELTER_MS);
      _log('Alert', `Shelter phase: maxMigun=${maxMigunMs}ms elapsed=${_alertStartTime ? Date.now()-_alertStartTime : '?'}ms`);
      const elapsed = _alertStartTime ? Date.now() - _alertStartTime : Infinity;
      const remaining = Math.max(0, maxMigunMs - elapsed);

      if (remaining > 0) {
        if (head) { head.textContent = '⏳ יש להישאר במרחב המוגן'; head.style.color = '#ff9100'; }
        if (instr) instr.textContent = `נותרו ${Math.ceil(remaining / 1000)} שניות להישאר במרחב המוגן`;
        const toastTitle = $('toastTitle');
        if (toastTitle) { toastTitle.textContent = '⏳ הישארו במרחב המוגן'; toastTitle.style.color = '#ff9100'; }
        const toastInner = $('toastInner');
        if (toastInner) {
          toastInner.style.borderColor = 'rgba(255,145,0,.55)';
          toastInner.style.background = 'rgba(255,145,0,.12)';
          toastInner.style.boxShadow = '0 0 32px rgba(255,145,0,.14)';
        }
        showToast('⏳ הישארו במרחב המוגן');
        window.soundSystem?.alertInfo();
        renderAreas(_lastActiveAreas, false, false, true);
        _lastActiveAreas.forEach(async (a) => {
          const geo = await getAreaGeo(a);
          if (geo) addPulseAt(geo.lon, geo.lat, '#ff9100', a);
        });
        if (_migunCountdownId) clearInterval(_migunCountdownId);
        const migunEnd = Date.now() + remaining;
        _migunCountdownId = setInterval(() => {
          const left = Math.max(0, Math.ceil((migunEnd - Date.now()) / 1000));
          const ins = $('instructions');
          if (ins) ins.textContent = left > 0 ? `נותרו ${left} שניות להישאר במרחב המוגן` : '';
          if (left <= 0) { clearInterval(_migunCountdownId); _migunCountdownId = null; }
        }, 1000);
        if (_migunTimeoutId) clearTimeout(_migunTimeoutId);
        _migunTimeoutId = setTimeout(() => {
          if (_migunCountdownId) { clearInterval(_migunCountdownId); _migunCountdownId = null; }
          _showExitClear();
        }, remaining);
      } else {
        _showExitClear();
      }
    } else if (hadActive && _lastAlertWasPre) {
      clearPulses(); renderAreas([]); _lastActiveAreas = []; _alertStartTime = 0; _lastAlertWasPre = false;
      if (head) { head.textContent = 'צבע אדום - ישראל'; head.style.color = 'var(--red)'; }
      if (instr) instr.textContent = '';
    } else {
      if (head) { head.textContent = 'צבע אדום - ישראל'; head.style.color = 'var(--red)'; }
      if (instr) instr.textContent = '';
      const toastTitle = $('toastTitle');
      if (toastTitle) { toastTitle.textContent = 'התראה נכנסת'; toastTitle.style.color = ''; }
      const toastInner = $('toastInner');
      if (toastInner) {
        toastInner.style.borderColor = 'rgba(255,23,68,.55)';
        toastInner.style.background = 'rgba(255,23,68,.12)';
        toastInner.style.boxShadow = '0 0 32px rgba(255,23,68,.14)';
      }
      renderAreas([]);
    }
    renderHazardsPanel();
    return;
  }

  if (_migunTimeoutId) {
    _log('Alert', '⚠️ NEW ALERT during shelter countdown — cancelling exit timer, resetting');
    clearTimeout(_migunTimeoutId); _migunTimeoutId = null;
  }
  if (_migunCountdownId) { clearInterval(_migunCountdownId); _migunCountdownId = null; }

  const isPre = Number(d.category) === 14;
  _lastAlertWasPre = isPre;
  if (d?.source === 'oref') _preferOrefUntil = Date.now() + 4 * 60 * 1000;
  const head = document.querySelector('#alertHead b');
  if (head) { head.textContent = isPre ? 'התרעה מקדימה - שפרו מיקום' : 'צבע אדום - ישראל'; head.style.color = isPre ? 'var(--amber)' : 'var(--red)'; }
  const toastTitle = $('toastTitle');
  if (toastTitle) { toastTitle.textContent = isPre ? 'התרעה מקדימה' : 'התראה נכנסת'; toastTitle.style.color = isPre ? '#ff9100' : ''; }
  const toastInner = $('toastInner');
  if (toastInner) {
    if (isPre) {
      toastInner.style.borderColor = 'rgba(255,145,0,.55)';
      toastInner.style.background = 'rgba(255,145,0,.12)';
      toastInner.style.boxShadow = '0 0 32px rgba(255,145,0,.14)';
    } else {
      toastInner.style.borderColor = 'rgba(255,23,68,.55)';
      toastInner.style.background = 'rgba(255,23,68,.12)';
      toastInner.style.boxShadow = '0 0 32px rgba(255,23,68,.14)';
    }
  }

  if (isPre) {
    const ins = $('instructions');
    if (ins) ins.textContent = 'שפרו מיקום והיערכו לכניסה למרחב המוגן';
  }
  renderAreas(d.areas || [], isPre);

  const sig = `${d.id}|${_watchEnabled}|${[..._watchlist].join(',')}`;
  if (!d.id || sig === lastAlertId) return;
  lastAlertId = sig;
  _alertStartTime = Date.now();
  _log('Alert', `NEW ALERT: id=${d.id} cat=${d.category} isPre=${isPre} areas=[${(d.areas||[]).slice(0,5).join(',')}${(d.areas||[]).length>5?'...':''}]`);

  clearPulses();

  const allAreas = Array.isArray(d.areas) ? d.areas : [];
  _lastActiveAreas = [...allAreas];
  const areas = filterAreas(allAreas);
  const color = isPre ? '#ff9100' : '#ff1744';

  const firstGeoPromise = areas[0] ? getAreaGeo(areas[0]) : Promise.resolve(null);

  areas.forEach(async (a, idx) => {
    const geo = await getAreaGeo(a);
    const migun = await getMigunSeconds(a);
    const el = document.getElementById(`migun-${idx}`);
    if (el) el.textContent = migun === null ? '---' : `${migun}s`;
    if (geo) {
      addPulseAt(geo.lon, geo.lat, color, a, false, d.category);
    } else {
      const r1 = hash01(a);
      const r2 = hash01(a + 'x');
      const dLon = (r1 - 0.5) * 0.32;
      const dLat = (r2 - 0.5) * 0.22;
      addPulseAt(ISRAEL_VIEW_3D.lon + dLon, ISRAEL_VIEW_3D.lat + dLat, color, a, false, d.category);
    }
  });

  if (!areas.length) {
    renderHazardsPanel();
    return;
  }

  const firstGeo = await firstGeoPromise;
  if (firstGeo) focusGeo(firstGeo.lon, firstGeo.lat, Math.min(israelAlt, 900000));
  else if (_mapMode === 'auto' || _mapMode === 'israel_flat') focusIsrael();

  showToast(d.summary || (isPre ? '⚠️ התרעה מקדימה: שפרו מיקום והיערכו לכניסה למרחב מוגן' : 'התראת צבע אדום'));
  if (isPre) window.soundSystem?.alertInfo(); else window.soundSystem?.alertCritical();
  renderHazardsPanel();
}

function initWebSocket() {
  if (_standalone) return;
  try {
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProto}://${location.host}/ws`;
    _log('WebSocket', `→ Connecting to ${wsUrl}...`);
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      _log('WebSocket', '✓ Connected');
      setConn(true);
      try { ws.send(JSON.stringify({ action: 'get_data' })); _log('WebSocket', '→ Sent get_data'); } catch(_) {}
      try { ws.send(JSON.stringify({ action: 'get_alerts' })); _log('WebSocket', '→ Sent get_alerts'); } catch(_) {}
    };
    ws.onclose = (ev) => { _logWarn('WebSocket', `✗ Closed (code=${ev.code} reason=${ev.reason||'none'}) → reconnect in 3s`); setConn(false); if (!_standalone) setTimeout(initWebSocket, 3000); };
    ws.onerror = (ev) => { _logErr('WebSocket', `✗ Error: ${ev?.message||'unknown'}`); };
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        _log('WebSocket', `← msg type=${ev.type}${ev.data?.items?.length != null ? ' items=' + ev.data.items.length : ''}`);
        if (ev.type === 'welcome') return;
        if (ev.type === 'israel_alerts') handleIsraelAlerts(ev.data).catch(() => {});
        if (ev.type === 'earthquake') live.earthquake = ev.data;
        if (ev.type === 'weather') live.weather = ev.data;
        if (ev.type === 'marine') live.marine = ev.data;
        if (ev.type === 'space_weather') live.space_weather = ev.data;
        if (ev.type === 'satellites') live.satellites = ev.data;
        if (ev.type === 'aviation') live.aviation = ev.data;
        if (ev.type === 'ships') live.ships = ev.data;
        if (ev.type === 'iss') live.iss = ev.data;
        if (ev.type === 'alert') pushAiAlert(ev.data);
        if (ev.type === 'ai_analysis') pushAiInsight(ev.data);
        if (ev.type === 'all_data') absorbAllData(ev.data);
        if (ev.type === 'alerts' && Array.isArray(ev.data)) aiAlerts = ev.data.slice(0, 40);
        refreshComposite();
      } catch(e) { _logErr('WebSocket', `Parse error: ${e?.message||e}`); }
    };
  } catch(e) { _logErr('WebSocket', `Init failed: ${e?.message||e}`); if (!_standalone) setTimeout(initWebSocket, 3000); }
}

let _standalone = false;

async function fetchPublicEarthquakes() {
  const t0 = performance.now();
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
  _log('Earthquake', `→ ${url}`);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    _log('Earthquake', `← HTTP ${r.status} ${r.statusText} (${(performance.now()-t0).toFixed(0)}ms)`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d?.features) { _logWarn('Earthquake', 'No features in response'); return; }
    live.earthquake = { timestamp: new Date().toISOString(), items: d.features.map(f => ({ id: f.id, magnitude: f.properties.mag, place: f.properties.place, time: f.properties.time, depth: f.geometry.coordinates[2], geo: { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] } })) };
    _log('Earthquake', `✓ ${live.earthquake.items.length} quakes (${(performance.now()-t0).toFixed(0)}ms)`);
  } catch(e) { _logErr('Earthquake', `✗ ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

async function fetchPublicSpaceWeather() {
  const t0 = performance.now();
  const kpUrl = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
  const swUrl = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
  _log('SpaceWx', `→ ${kpUrl}`);
  _log('SpaceWx', `→ ${swUrl}`);
  try {
    const [kpR, swR] = await Promise.all([
      fetch(kpUrl, { signal: AbortSignal.timeout(6000) }).then(r => { _log('SpaceWx', `← KP HTTP ${r.status}`); return r.json(); }).catch(e => { _logWarn('SpaceWx', `✗ KP failed: ${e?.message||e}`); return null; }),
      fetch(swUrl, { signal: AbortSignal.timeout(6000) }).then(r => { _log('SpaceWx', `← SolarWind HTTP ${r.status}`); return r.json(); }).catch(e => { _logWarn('SpaceWx', `✗ SolarWind failed: ${e?.message||e}`); return null; })
    ]);
    const sw = {};
    if (Array.isArray(kpR) && kpR.length > 1) {
      const obs = kpR.filter(r => r[2] === 'observed').pop() || kpR[kpR.length - 1];
      sw.kpIndex = parseFloat(obs[1]) || 0;
    }
    if (Array.isArray(swR) && swR.length > 2) {
      const last = swR[swR.length - 1];
      sw.solarWindSpeed = parseFloat(last[2]) || null;
      sw.solarWindDensity = parseFloat(last[1]) || null;
    }
    if (sw.kpIndex !== undefined) { live.space_weather = { ...sw, timestamp: new Date().toISOString() }; _log('SpaceWx', `✓ KP=${sw.kpIndex} wind=${sw.solarWindSpeed||'?'} density=${sw.solarWindDensity||'?'} (${(performance.now()-t0).toFixed(0)}ms)`); }
    else _logWarn('SpaceWx', `✗ No KP data (${(performance.now()-t0).toFixed(0)}ms)`);
  } catch(e) { _logErr('SpaceWx', `✗ ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

async function fetchPublicWeather() {
  const t0 = performance.now();
  _log('Weather', `→ Fetching Open-Meteo (${_standalone ? 'standalone' : 'server'})...`);
  try {
    const cities = _standalone ? [
      { name:'Tel Aviv', lat:32.08, lon:34.78 }, { name:'Jerusalem', lat:31.77, lon:35.21 }, { name:'Haifa', lat:32.79, lon:34.99 },
      { name:'Eilat', lat:29.56, lon:34.95 }, { name:'Amman', lat:31.95, lon:35.93 }, { name:'Cairo', lat:30.04, lon:31.24 }
    ] : [
      { name:'Tel Aviv', lat:32.08, lon:34.78 }, { name:'Jerusalem', lat:31.77, lon:35.21 }, { name:'Haifa', lat:32.79, lon:34.99 },
      { name:'Cairo', lat:30.04, lon:31.24 }, { name:'Amman', lat:31.95, lon:35.93 }, { name:'Beirut', lat:33.89, lon:35.50 },
      { name:'Istanbul', lat:41.01, lon:28.98 }, { name:'Riyadh', lat:24.69, lon:46.72 }, { name:'Dubai', lat:25.20, lon:55.27 },
      { name:'Tehran', lat:35.69, lon:51.39 }, { name:'Athens', lat:37.98, lon:23.73 }, { name:'Ankara', lat:39.93, lon:32.86 },
      { name:'Baghdad', lat:33.31, lon:44.37 }, { name:'Damascus', lat:33.51, lon:36.29 }, { name:'Nairobi', lat:-1.29, lon:36.82 },
      { name:'London', lat:51.51, lon:-0.13 }, { name:'Paris', lat:48.86, lon:2.35 }, { name:'Berlin', lat:52.52, lon:13.41 },
      { name:'Moscow', lat:55.76, lon:37.62 }, { name:'New York', lat:40.71, lon:-74.01 }, { name:'Tokyo', lat:35.68, lon:139.69 },
      { name:'Beijing', lat:39.90, lon:116.40 }, { name:'Sydney', lat:-33.87, lon:151.21 }, { name:'Mumbai', lat:19.08, lon:72.88 }
    ];
    const lats = cities.map(c => c.lat).join(',');
    const lons = cities.map(c => c.lon).join(',');
    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current_weather=true`;
    _log('Weather', `→ ${wxUrl.substring(0,80)}...`);
    const r = await fetch(wxUrl, { signal: AbortSignal.timeout(10000) });
    _log('Weather', `← HTTP ${r.status} ${r.statusText} (${(performance.now()-t0).toFixed(0)}ms)`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const items = (Array.isArray(d) ? d : [d]).map((w, i) => {
      const cw = w.current_weather || {};
      return { city: cities[i]?.name || '', temperature: cw.temperature, windspeed: cw.windspeed, geo: { lat: cities[i]?.lat, lon: cities[i]?.lon } };
    }).filter(x => x.geo && x.temperature !== undefined);
    if (items.length) { live.weather = { timestamp: new Date().toISOString(), items }; _log('Weather', `✓ ${items.length} cities (${(performance.now()-t0).toFixed(0)}ms)`); }
    else _logWarn('Weather', '✗ No weather items parsed');
  } catch(e) { _logErr('Weather', `✗ Open-Meteo: ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
  if (!live.weather && _standalone) {
    _log('Weather', '→ Fallback: https://wttr.in/Tel+Aviv?format=j1');
    try {
      const r = await fetch('https://wttr.in/Tel+Aviv?format=j1', { signal: AbortSignal.timeout(6000) });
      _log('Weather', `← wttr.in HTTP ${r.status}`);
      const d = await r.json();
      const cc = d?.current_condition?.[0];
      if (cc) { live.weather = { timestamp: new Date().toISOString(), items: [{ city: 'Tel Aviv', temperature: parseFloat(cc.temp_C), windspeed: parseFloat(cc.windspeedKmph), humidity: parseFloat(cc.humidity), geo: { lat: 32.08, lon: 34.78 } }] }; _log('Weather', '✓ wttr.in fallback OK'); }
      else _logWarn('Weather', '✗ wttr.in no data');
    } catch(e2) { _logErr('Weather', `✗ wttr.in fallback: ${e2?.message||e2}`); }
  }
}

async function fetchPublicSatellites() {
  const t0 = performance.now();
  const tleUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';
  _log('Satellites', `→ ${tleUrl}`);
  let text = null;
  // Direct first (CelesTrak has CORS * from GitHub Pages)
  try {
    _log('Satellites', '→ Trying direct...');
    const r = await fetch(tleUrl, { signal: AbortSignal.timeout(10000) });
    _log('Satellites', `← Direct HTTP ${r.status} (${(performance.now()-t0).toFixed(0)}ms)`);
    if (r.ok) text = await r.text();
  } catch(e) { _logWarn('Satellites', `✗ Direct: ${e?.message||e}`); }
  // Fallback to CORS proxies
  if (!text || text.length < 50) {
    _log('Satellites', '→ Trying CORS proxies...');
    text = await _corsFetch(tleUrl, 10000);
  }
  if (!text) { _logErr('Satellites', `✗ No TLE data (${(performance.now()-t0).toFixed(0)}ms)`); return; }
  try {
    const lines = text.trim().split('\n');
    const items = [];
    for (let i = 0; i + 2 < lines.length; i += 3) {
      const name = lines[i].trim();
      const tle1 = lines[i+1].trim();
      const tle2 = lines[i+2].trim();
      if (tle1.startsWith('1 ') && tle2.startsWith('2 ')) {
        const noradId = parseInt(tle1.substring(2, 7));
        items.push({ name, noradId, tle1, tle2 });
      }
      if (items.length >= 200) break;
    }
    if (items.length) { live.satellites = { timestamp: new Date().toISOString(), items }; _log('Satellites', `✓ ${items.length} satellites (${(performance.now()-t0).toFixed(0)}ms)`); }
    else _logWarn('Satellites', `✗ No TLE entries parsed (${(performance.now()-t0).toFixed(0)}ms)`);
  } catch(e) { _logErr('Satellites', `✗ Parse: ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

async function fetchPublicMarine() {
  const t0 = performance.now();
  _log('Marine', `→ Fetching marine data (${_standalone ? 'standalone' : 'server'})...`);
  try {
    const pts = _standalone ? [
      {lat:32.0,lon:34.2,n:'Med-TLV'},{lat:33.0,lon:34.0,n:'Med-Haifa'},{lat:29.5,lon:34.9,n:'RedSea-Eilat'},{lat:35.0,lon:18.0,n:'Med-Central'}
    ] : [
      {lat:32.0,lon:34.2,n:'Med-TLV'},{lat:33.0,lon:34.0,n:'Med-Haifa'},{lat:29.5,lon:34.9,n:'RedSea-Eilat'},
      {lat:35.0,lon:18.0,n:'Med-Central'},{lat:36.0,lon:28.0,n:'Aegean'},{lat:34.0,lon:25.0,n:'Med-Crete'},
      {lat:41.0,lon:29.0,n:'BlackSea'},{lat:25.0,lon:37.0,n:'RedSea-N'},{lat:24.0,lon:55.0,n:'PersianGulf'},
      {lat:12.0,lon:45.0,n:'GulfAden'},{lat:40.0,lon:-30.0,n:'Atlantic-N'},{lat:35.0,lon:140.0,n:'Pacific-JP'},
      {lat:25.0,lon:-90.0,n:'GulfMexico'},{lat:55.0,lon:-5.0,n:'NorthSea'},{lat:10.0,lon:80.0,n:'Indian'},
      {lat:-35.0,lon:150.0,n:'Tasman'},{lat:0.0,lon:-25.0,n:'Atlantic-Eq'},{lat:-10.0,lon:50.0,n:'Indian-W'}
    ];
    const lats = pts.map(p=>p.lat).join(','), lons = pts.map(p=>p.lon).join(',');
    const marUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&current=wave_height,wave_period`;
    _log('Marine', `→ ${marUrl.substring(0,80)}...`);
    const r = await fetch(marUrl, { signal: AbortSignal.timeout(10000) });
    _log('Marine', `← HTTP ${r.status} ${r.statusText} (${(performance.now()-t0).toFixed(0)}ms)`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const arr = Array.isArray(d) ? d : [d];
    const items = arr.map((m, i) => {
      const wh = m?.current?.wave_height;
      if (!Number.isFinite(wh) || wh <= 0) return null;
      return { station: pts[i]?.n || `P${i}`, geo: { lat: pts[i].lat, lon: pts[i].lon }, waveHeight: wh, waterTemp: null };
    }).filter(Boolean);
    if (items.length) { live.marine = { timestamp: new Date().toISOString(), items }; _log('Marine', `✓ ${items.length} buoys (${(performance.now()-t0).toFixed(0)}ms)`); }
    else _logWarn('Marine', `✗ No marine data (${(performance.now()-t0).toFixed(0)}ms)`);
  } catch(e) { _logErr('Marine', `✗ ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

async function fetchPublicISS() {
  const t0 = performance.now();
  const url = 'https://api.wheretheiss.at/v1/satellites/25544';
  _log('ISS', `→ ${url}`);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    _log('ISS', `← HTTP ${r.status} (${(performance.now()-t0).toFixed(0)}ms)`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d?.latitude && d?.longitude) { live.iss = { geo: { lat: d.latitude, lon: d.longitude }, altitude: d.altitude }; _log('ISS', `✓ lat=${d.latitude.toFixed(1)} lon=${d.longitude.toFixed(1)} alt=${d.altitude?.toFixed(0)||'?'}km (${(performance.now()-t0).toFixed(0)}ms)`); }
    else _logWarn('ISS', '✗ No position data');
  } catch(e) { _logErr('ISS', `✗ ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

const _MIL_HEX = [
  ['ae', 'af', '\u05e6\u05d1\u05d0 \u05d0\u05e8\u05d4"\u05d1'],
  ['43c', '43c', 'UK Military'],
  ['3b', '3b', 'French Military'],
  ['3e', '3e', 'German Military'],
  ['150', '15f', 'Russian Military'],
  ['4b8', '4bf', 'Turkish Military'],
  ['730', '737', 'Iranian Military'],
  ['778', '77f', 'Syrian Military'],
  ['e4', 'e4', 'NATO'],
];
const _IL_AIRLINE_CS = ['ELY','LY','ICL','6H','ISR','5C','RVR'];

function _classifyAircraft(icao24, callsign, country, category) {
  const hex = (icao24 || '').toLowerCase();
  for (const [lo, hi, label] of _MIL_HEX) {
    if (hex >= lo && hex <= hi + 'ffff') return { mil: true, label };
  }
  const cs = (callsign || '').trim().toUpperCase();
  if (!cs && country && country !== 'Israel') return { mil: true, label: `${country} (\u05dc\u05dc\u05d0 callsign)` };
  const cat = Number(category) || 0;
  if (cat === 14) return { mil: true, label: `UAV ${country || ''}` };
  if (_IL_AIRLINE_CS.some(p => cs.startsWith(p))) return { mil: false, label: '' };
  return { mil: false, label: '' };
}

async function _fetchAviationOpenSky() {
  const url = `https://opensky-network.org/api/states/all?lamin=${ISRAEL_EXT_BOUNDS.minLat}&lamax=${ISRAEL_EXT_BOUNDS.maxLat}&lomin=${ISRAEL_EXT_BOUNDS.minLon}&lomax=${ISRAEL_EXT_BOUNDS.maxLon}`;
  _log('Aviation', `→ OpenSky: ${url.substring(0,70)}...`);
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  _log('Aviation', `← OpenSky HTTP ${r.status}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d?.states?.length) return [];
  return d.states.filter(s => s[5] != null && s[6] != null && !s[8]).map(s => {
    const cls = _classifyAircraft(s[0], s[1], s[2], s[17]);
    return {
      icao24: s[0], callsign: (s[1] || '').trim(), country: s[2],
      geo: { lat: s[6], lon: s[5], alt: s[13] || s[7] || 0 },
      altitude: s[13] || s[7] || 0, heading: s[10], velocity: s[9],
      verticalRate: s[11], squawk: s[14], category: s[17],
      isMilitary: cls.mil, milLabel: cls.label, timestamp: new Date().toISOString()
    };
  });
}

async function _fetchAviationADSBLive() {
  const lat = (ISRAEL_EXT_BOUNDS.minLat + ISRAEL_EXT_BOUNDS.maxLat) / 2;
  const lon = (ISRAEL_EXT_BOUNDS.minLon + ISRAEL_EXT_BOUNDS.maxLon) / 2;
  const url = `https://api.airplanes.live/v2/point/${lat.toFixed(2)}/${lon.toFixed(2)}/250`;
  _log('Aviation', `→ airplanes.live: ${url}`);
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  _log('Aviation', `← airplanes.live HTTP ${r.status}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const ac = d?.ac || [];
  if (!ac.length) return [];
  return ac.filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon)).map(a => {
    const cls = _classifyAircraft(a.hex || '', a.flight || '', a.r || '', a.t || '');
    const alt = _safeNum(a.alt_baro === 'ground' ? 0 : a.alt_baro, _safeNum(a.alt_geom, 0));
    return {
      icao24: a.hex || '', callsign: (a.flight || '').trim(), country: a.r || '',
      geo: { lat: a.lat, lon: a.lon, alt },
      altitude: alt, heading: _safeNum(a.track, _safeNum(a.true_heading, null)), velocity: a.gs != null ? _safeNum(a.gs) * 0.5144 : null,
      verticalRate: _safeNum(a.baro_rate, _safeNum(a.geom_rate, null)), squawk: a.squawk || '', category: a.category || a.t || '',
      isMilitary: cls.mil || (a.dbFlags & 1) === 1, milLabel: cls.label || (((a.dbFlags & 1) === 1) ? `MIL ${a.r||''}` : ''),
      timestamp: new Date().toISOString()
    };
  });
}

async function fetchPublicAviation() {
  const t0 = performance.now();
  _log('Aviation', `→ Fetching aircraft (${_standalone ? 'standalone' : 'server'})...`);
  let items = [];
  // Strategy 1: OpenSky (may 429)
  try { items = await _fetchAviationOpenSky(); } catch(e) { _logWarn('Aviation', `✗ OpenSky: ${e?.message||e}`); }
  // Strategy 2: airplanes.live (free, CORS *)
  if (!items.length) {
    try { items = await _fetchAviationADSBLive(); } catch(e) { _logWarn('Aviation', `✗ airplanes.live: ${e?.message||e}`); }
  }
  // Strategy 3: OpenSky via CORS proxy
  if (!items.length) {
    _log('Aviation', '→ Trying OpenSky via CORS proxy...');
    try {
      const url = `https://opensky-network.org/api/states/all?lamin=${ISRAEL_EXT_BOUNDS.minLat}&lamax=${ISRAEL_EXT_BOUNDS.maxLat}&lomin=${ISRAEL_EXT_BOUNDS.minLon}&lomax=${ISRAEL_EXT_BOUNDS.maxLon}`;
      const text = await _corsFetch(url, 12000);
      if (text) {
        const d = JSON.parse(text);
        if (d?.states?.length) items = d.states.filter(s => s[5] != null && s[6] != null && !s[8]).map(s => {
          const cls = _classifyAircraft(s[0], s[1], s[2], s[17]);
          return { icao24: s[0], callsign: (s[1]||'').trim(), country: s[2], geo: { lat: s[6], lon: s[5], alt: s[13]||s[7]||0 }, altitude: s[13]||s[7]||0, heading: s[10], velocity: s[9], verticalRate: s[11], squawk: s[14], category: s[17], isMilitary: cls.mil, milLabel: cls.label, timestamp: new Date().toISOString() };
        });
      }
    } catch(e2) { _logErr('Aviation', `✗ CORS proxy: ${e2?.message||e2}`); }
  }
  if (!items.length) { _logWarn('Aviation', `✗ No aircraft from any source (${(performance.now()-t0).toFixed(0)}ms)`); return; }
  const mil = items.filter(i => i.isMilitary).length;
  live.aviation = { timestamp: new Date().toISOString(), items };
  _log('Aviation', `✓ ${items.length} aircraft (${mil} military) in ${(performance.now()-t0).toFixed(0)}ms`);
}

const _SHIP_TYPES = {
  20:'Wing-in-Ground',21:'WIG Hazcat A',22:'WIG Hazcat B',23:'WIG Hazcat C',24:'WIG Hazcat D',
  30:'דיג',31:'גרירה',32:'גרירה (גדול)',33:'חפירה/תת-ימי',34:'צלילה',35:'צבאי',36:'מפרשית',37:'סירת הנאה',
  40:'כלי שיט מהיר',41:'HSC Hazcat A',42:'HSC Hazcat B',43:'HSC Hazcat C',44:'HSC Hazcat D',
  50:'נתב (Pilot)',51:'חילוץ (SAR)',52:'גוררת',53:'סירת נמל',54:'מניעת זיהום',55:'אכיפת חוק',
  60:'נוסעים',61:'נוסעים Hazcat A',62:'נוסעים Hazcat B',63:'נוסעים Hazcat C',64:'נוסעים Hazcat D',
  69:'נוסעים (אחר)',
  70:'מטען',71:'מטען Hazcat A',72:'מטען Hazcat B',73:'מטען Hazcat C',74:'מטען Hazcat D',79:'מטען (אחר)',
  80:'מכלית',81:'מכלית Hazcat A',82:'מכלית Hazcat B',83:'מכלית Hazcat C',84:'מכלית Hazcat D',89:'מכלית (אחר)',
  90:'אחר',91:'אחר',99:'אחר'
};
function _shipTypeName(t) {
  if (_SHIP_TYPES[t]) return _SHIP_TYPES[t];
  if (t >= 70 && t <= 79) return 'מטען';
  if (t >= 80 && t <= 89) return 'מכלית';
  if (t >= 60 && t <= 69) return 'נוסעים';
  if (t >= 40 && t <= 49) return 'כלי שיט מהיר';
  if (t >= 30 && t <= 39) return 'שירות';
  return 'לא ידוע';
}
const _NAV_STATUS = {0:'בדרך (מנוע)',1:'עוגנת',2:'לא בשליטה',3:'כושר תמרון מוגבל',4:'שוקע מוגבל',5:'עוגנת (מאובטח)',6:'על שרטון',7:'דיג',8:'מפליגה (מפרש)',11:'גרירה',14:'AIS-SART',15:'לא מוגדר'};

let _vesselMeta = null;
let _vesselMetaAge = 0;

async function _loadVesselMeta() {
  if (_vesselMeta && Date.now() - _vesselMetaAge < 3600000) return _vesselMeta;
  _log('Ships', '→ Loading vessel metadata...');
  try {
    const r = await fetch('https://meri.digitraffic.fi/api/ais/v1/vessels', { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const arr = await r.json();
    _vesselMeta = new Map();
    (Array.isArray(arr) ? arr : []).forEach(v => { if (v.mmsi) _vesselMeta.set(v.mmsi, v); });
    _vesselMetaAge = Date.now();
    _log('Ships', `✓ ${_vesselMeta.size} vessel metadata entries`);
    return _vesselMeta;
  } catch(e) { _logWarn('Ships', `Metadata load failed: ${e?.message||e}`); return _vesselMeta || new Map(); }
}

async function fetchPublicShips() {
  const t0 = performance.now();
  _log('Ships', '→ Fetching real AIS data (Digitraffic)...');
  let realItems = [];
  try {
    const [metaMap, locR] = await Promise.all([
      _loadVesselMeta(),
      fetch('https://meri.digitraffic.fi/api/ais/v1/locations', { signal: AbortSignal.timeout(12000) })
    ]);
    if (!locR.ok) throw new Error(`HTTP ${locR.status}`);
    const geo = await locR.json();
    const features = geo?.features || [];
    _log('Ships', `→ Raw AIS locations: ${features.length}`);
    realItems = features.slice(0, _standalone ? 300 : 600).map(f => {
      const p = f.properties || {};
      const c = f.geometry?.coordinates || [];
      const meta = metaMap?.get(p.mmsi) || {};
      return {
        name: meta.name || '', mmsi: p.mmsi, imo: meta.imo || null,
        callSign: meta.callSign || '', destination: meta.destination || '',
        shipType: meta.shipType || 0, shipTypeName: _shipTypeName(meta.shipType || 0),
        draught: meta.draught ? meta.draught / 10 : null,
        eta: meta.eta || null,
        navStatus: _NAV_STATUS[p.navStat] || '',
        speed: p.sog != null ? p.sog / 10 : null,
        heading: p.heading < 511 ? p.heading : (p.cog != null ? p.cog / 10 : null),
        cog: p.cog != null ? p.cog / 10 : null,
        geo: { lat: c[1], lon: c[0] },
        timestamp: p.timestampExternal ? new Date(p.timestampExternal).toISOString() : new Date().toISOString(),
        source: 'digitraffic'
      };
    }).filter(s => s.geo.lat && s.geo.lon);
    _log('Ships', `✓ ${realItems.length} real AIS ships (${(performance.now()-t0).toFixed(0)}ms)`);
  } catch(e) { _logErr('Ships', `Digitraffic failed: ${e?.message||e}`); }

  const medPorts = [
    {name:'Haifa Cargo',lat:32.82,lon:35.00,h:270,t:70,dst:'ILHFA'},{name:'Ashdod Container',lat:31.83,lon:34.63,h:250,t:70,dst:'ILASH'},
    {name:'Eilat Tanker',lat:29.55,lon:34.96,h:180,t:80,dst:'ILEIL'},{name:'Suez Transit',lat:31.25,lon:32.31,h:45,t:80,dst:'EGPSD'},
    {name:'Med Bulker',lat:33.2,lon:33.8,h:210,t:70,dst:'CYLMS'},{name:'Limassol Ferry',lat:34.65,lon:33.03,h:90,t:60,dst:'CYLMS'},
    {name:'Piraeus Express',lat:35.5,lon:31.0,h:300,t:60,dst:'GRPIR'},{name:'Med Tanker',lat:32.5,lon:33.0,h:180,t:80,dst:'EGALY'},
    {name:'Aqaba Star',lat:29.48,lon:34.98,h:0,t:70,dst:'JOAQJ'},{name:'Alexandria Cargo',lat:31.2,lon:29.9,h:90,t:70,dst:'EGALY'},
    {name:'Mersin Link',lat:36.6,lon:34.6,h:180,t:60,dst:'TRMER'},{name:'Tartus Freight',lat:34.9,lon:35.85,h:270,t:70,dst:'SYTAR'},
    {name:'Crete Passage',lat:35.2,lon:24.5,h:90,t:70,dst:'GRHER'},{name:'Red Sea Tanker',lat:27.8,lon:34.3,h:180,t:80,dst:'SAJED'},
    {name:'Bab el-Mandeb',lat:12.6,lon:43.3,h:0,t:80,dst:'DJJIB'},{name:'Gulf Carrier',lat:26.5,lon:52.0,h:90,t:80,dst:'AEJEA'},
    {name:'Istanbul Ferry',lat:41.0,lon:29.0,h:200,t:60,dst:'TRIST'},{name:'Suez South',lat:30.0,lon:32.58,h:180,t:70,dst:'EGPSD'}
  ];
  const medItems = medPorts.map((p, i) => ({
    name: p.name, mmsi: `MED${200+i}`, imo: null, callSign: '',
    destination: p.dst, shipType: p.t, shipTypeName: _shipTypeName(p.t),
    draught: 5 + Math.random() * 10, eta: null,
    navStatus: 'בדרך (מנוע)', speed: 5 + Math.random() * 15,
    heading: p.h + (Math.random() - .5) * 20,
    cog: p.h + (Math.random() - .5) * 20,
    geo: { lat: p.lat + (Math.random() - .5) * .1, lon: p.lon + (Math.random() - .5) * .1 },
    timestamp: new Date().toISOString(), source: 'med-fallback'
  }));

  const items = [...realItems, ...medItems];
  if (items.length) {
    live.ships = { timestamp: new Date().toISOString(), items };
    _log('Ships', `✓ Total: ${items.length} ships (${realItems.length} real + ${medItems.length} Mediterranean) in ${(performance.now()-t0).toFixed(0)}ms`);
  } else {
    _logWarn('Ships', 'No ship data at all');
  }
}

// ═══════════════════════════════════════════════════════
// NEW DATA SOURCES — free APIs
// ═══════════════════════════════════════════════════════

async function fetchPublicDisasters() {
  const t0 = performance.now();
  _log('Disasters', '→ Fetching NASA EONET + GDACS...');
  const items = [];

  // NASA EONET — natural events
  try {
    const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30', { signal: AbortSignal.timeout(10000) });
    _log('Disasters', `← EONET HTTP ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      (d.events || []).forEach(ev => {
        const geo = ev.geometry?.[0];
        if (!geo?.coordinates) return;
        const [lon, lat] = geo.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        items.push({
          id: ev.id, title: ev.title, category: ev.categories?.[0]?.title || '',
          geo: { lat, lon }, date: geo.date || ev.geometry?.[0]?.date,
          source: 'NASA-EONET', link: ev.link || ''
        });
      });
      _log('Disasters', `✓ EONET: ${items.length} events`);
    }
  } catch(e) { _logWarn('Disasters', `✗ EONET: ${e?.message||e}`); }

  // GDACS — global disaster alerts
  try {
    const r = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;DR;WF&alertlevel=Green;Orange;Red&limit=20', { signal: AbortSignal.timeout(10000) });
    _log('Disasters', `← GDACS HTTP ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const features = d.features || [];
      let added = 0;
      features.forEach(f => {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates;
        if (!coords || !Number.isFinite(coords[1]) || !Number.isFinite(coords[0])) return;
        items.push({
          id: p.eventid || `gdacs-${added}`, title: p.name || p.eventtype || '',
          category: p.eventtype || '', alertLevel: p.alertlevel || '',
          geo: { lat: coords[1], lon: coords[0] }, date: p.fromdate || '',
          source: 'GDACS', severity: p.severity?.severitytext || ''
        });
        added++;
      });
      _log('Disasters', `✓ GDACS: ${added} events`);
    }
  } catch(e) { _logWarn('Disasters', `✗ GDACS: ${e?.message||e}`); }

  if (items.length) {
    live.disasters = { timestamp: new Date().toISOString(), items };
    _log('Disasters', `✓ Total: ${items.length} events (${(performance.now()-t0).toFixed(0)}ms)`);
  } else {
    _logWarn('Disasters', `✗ No disaster data (${(performance.now()-t0).toFixed(0)}ms)`);
  }
}

async function fetchPublicFires() {
  const t0 = performance.now();
  _log('Fires', '→ Fetching NASA FIRMS...');
  try {
    const r = await fetch('https://firms.modaps.eosdis.nasa.gov/api/area/csv/DEMO_KEY/VIIRS_SNPP_NRT/world/1', { signal: AbortSignal.timeout(15000) });
    _log('Fires', `← FIRMS HTTP ${r.status}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { _logWarn('Fires', '✗ No fire data'); return; }
    const header = lines[0].split(',');
    const latIdx = header.indexOf('latitude');
    const lonIdx = header.indexOf('longitude');
    const brightIdx = header.indexOf('bright_ti4');
    const confIdx = header.indexOf('confidence');
    const dateIdx = header.indexOf('acq_date');
    const items = [];
    for (let i = 1; i < Math.min(lines.length, 500); i++) {
      const cols = lines[i].split(',');
      const lat = parseFloat(cols[latIdx]);
      const lon = parseFloat(cols[lonIdx]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      items.push({
        geo: { lat, lon }, brightness: parseFloat(cols[brightIdx]) || 0,
        confidence: cols[confIdx] || '', date: cols[dateIdx] || '', source: 'NASA-FIRMS'
      });
    }
    if (items.length) {
      live.fires = { timestamp: new Date().toISOString(), items };
      _log('Fires', `✓ ${items.length} hotspots (${(performance.now()-t0).toFixed(0)}ms)`);
    }
  } catch(e) { _logWarn('Fires', `✗ FIRMS: ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

async function fetchPublicEMSC() {
  const t0 = performance.now();
  _log('EMSC', '→ Fetching European seismic data...');
  try {
    const r = await fetch('https://www.seismicportal.eu/fdsnws/event/1/query?limit=30&format=json&minmag=3', { signal: AbortSignal.timeout(10000) });
    _log('EMSC', `← SeismicPortal HTTP ${r.status}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const features = d.features || [];
    const items = features.map(f => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      return {
        id: f.id || '', mag: p.mag, place: p.flynn_region || p.auth || '',
        geo: { lat: coords[1], lon: coords[0], depth: coords[2] },
        time: p.time || '', source: 'EMSC'
      };
    }).filter(e => Number.isFinite(e.geo.lat) && Number.isFinite(e.geo.lon));
    if (items.length) {
      live.emsc_earthquakes = { timestamp: new Date().toISOString(), items };
      _log('EMSC', `✓ ${items.length} earthquakes (${(performance.now()-t0).toFixed(0)}ms)`);
    }
  } catch(e) { _logWarn('EMSC', `✗ ${e?.message||e} (${(performance.now()-t0).toFixed(0)}ms)`); }
}

async function fetchPublicGlobalAlerts() {
  const t0 = performance.now();
  _log('GlobalAlerts', '→ Fetching NWS + MeteoAlarm...');
  const items = [];

  // NWS US alerts
  try {
    const r = await fetch('https://api.weather.gov/alerts/active?limit=20', {
      signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'RealityCore/1.0' }
    });
    _log('GlobalAlerts', `← NWS HTTP ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      (d.features || []).forEach(f => {
        const p = f.properties || {};
        items.push({
          id: p.id, headline: p.headline || '', event: p.event || '',
          severity: p.severity || '', urgency: p.urgency || '',
          area: p.areaDesc || '', source: 'NWS-US',
          effective: p.effective, expires: p.expires
        });
      });
      _log('GlobalAlerts', `✓ NWS: ${d.features?.length||0} alerts`);
    }
  } catch(e) { _logWarn('GlobalAlerts', `✗ NWS: ${e?.message||e}`); }

  if (items.length) {
    live.global_alerts = { timestamp: new Date().toISOString(), items };
    _log('GlobalAlerts', `✓ Total: ${items.length} alerts (${(performance.now()-t0).toFixed(0)}ms)`);
  }
}

async function _corsFetch(url, timeout = 10000) {
  const enc = encodeURIComponent(url);
  const proxyNames = [];
  const attempts = [];
  if (_PROXY) { proxyNames.push('custom-proxy'); attempts.push(() => fetch(`${_PROXY}?url=${enc}`, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.text(); })); }
  proxyNames.push('allorigins'); attempts.push(() => fetch(`https://api.allorigins.win/get?url=${enc}`, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => j?.contents || ''));
  proxyNames.push('codetabs'); attempts.push(() => fetch(`https://api.codetabs.com/v1/proxy/?quest=${enc}`, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.text(); }));
  proxyNames.push('direct'); attempts.push(() => fetch(url, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.text(); }));
  for (let i = 0; i < attempts.length; i++) {
    const name = proxyNames[i];
    try {
      _log('CORS', `→ Trying ${name} for ${url.substring(0,60)}...`);
      const t = await attempts[i]();
      if (t && t.length > 1) { _log('CORS', `✓ ${name} OK (${t.length} chars)`); return t; }
      _logWarn('CORS', `✗ ${name} returned empty`);
    } catch(e) { _logWarn('CORS', `✗ ${name} failed: ${e?.message||e}`); }
  }
  _logErr('CORS', `✗ All proxies failed for ${url.substring(0,60)}`);
  return null;
}

const _EXIT_PATTERNS = ['יכולים לצאת', 'ניתן לצאת', 'האירוע הסתיים', 'הסתיים האירוע', 'הסתיימה ההתרעה'];

function _isExitNotification(title) {
  return _EXIT_PATTERNS.some(p => title.includes(p));
}

function _parseRedAlertResponse(text) {
  if (!text || text.trim().length < 3) return { active: false };
  try {
    const d = JSON.parse(text);
    if (Array.isArray(d)) {
      if (!d.length) return { active: false };
      const first = d[0];
      const title = first.title || first.desc || '';
      const areas = first.cities || first.data
        ? (first.cities || (typeof first.data === 'string' ? first.data.split(',').map(s => s.trim()) : first.data))
        : (first.areas || []);
      if (_isExitNotification(title)) return { active: false, isExit: true, id: first.notificationId || first.id || `exit-${Date.now()}`, areas, desc: title, category: first.cat || first.threat || 0, source: 'tzevaadom', timestamp: new Date().toISOString() };
      if (areas.length) return { active: true, id: first.notificationId || first.id || `pub-${Date.now()}`, areas, desc: title, category: first.cat || first.threat || 1, source: 'tzevaadom', timestamp: new Date().toISOString() };
    } else if (d && typeof d === 'object') {
      const title = d.title || d.desc || '';
      if (d.data || d.cities) {
        const areas = d.cities || (typeof d.data === 'string' ? d.data.split(',').map(s => s.trim()) : (d.data || []));
        if (_isExitNotification(title)) return { active: false, isExit: true, id: d.id || `exit-${Date.now()}`, areas, desc: title, category: d.cat || d.threat || 0, source: 'tzevaadom', timestamp: new Date().toISOString() };
        if (areas.length) return { active: true, id: d.id || `pub-${Date.now()}`, areas, desc: title, category: d.cat || d.threat || 1, source: 'tzevaadom', timestamp: new Date().toISOString() };
      }
    }
  } catch(_) {}
  return { active: false };
}

async function fetchPublicRedAlert() {
  const t0 = performance.now();
  _log('RedAlert', '→ Checking alert sources...');

  const orefUrl = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
  const tzevaUrl = 'https://api.tzevaadom.co.il/notifications';
  const orefEnc = encodeURIComponent(orefUrl);
  const tzevaEnc = encodeURIComponent(tzevaUrl);

  const paths = [
    // 1. oref.org.il direct (works locally / same-origin, may CORS-block from GitHub)
    { name: 'oref-direct', fn: () => fetch(orefUrl, { signal: AbortSignal.timeout(4000), headers: { 'Referer': 'https://www.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest' } }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) },
    // 2. tzevaadom via allorigins (reliable from GitHub Pages)
    { name: 'tzeva-allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${tzevaEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(j => j?.contents || '') },
    // 3. oref via allorigins
    { name: 'oref-allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${orefEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(j => j?.contents || '') },
    // 4. tzevaadom via codetabs
    { name: 'tzeva-codetabs', fn: () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${tzevaEnc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) },
    // 5. custom proxy (if configured)
    ..._PROXY ? [{ name: 'custom-proxy', fn: () => fetch(`${_PROXY}?url=${tzevaEnc}`, { signal: AbortSignal.timeout(6000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) }] : [],
    // 6. tzevaadom direct (works locally)
    { name: 'tzeva-direct', fn: () => fetch(tzevaUrl, { signal: AbortSignal.timeout(5000) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }) }
  ];

  for (const { name, fn } of paths) {
    try {
      _log('RedAlert', `→ Trying ${name}...`);
      const text = await fn();
      if (!text || text.trim().length < 2) { _logWarn('RedAlert', `✗ ${name}: empty response`); continue; }
      _log('RedAlert', `← ${name}: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
      const result = _parseRedAlertResponse(text);
      if (result) {
        _log('RedAlert', `✓ ${name} → active:${result.active} isExit:${!!result.isExit} areas:${result.areas?.length||0} (${(performance.now()-t0).toFixed(0)}ms)`);
        if (result.active) _log('RedAlert', `🚨 ALERT ACTIVE! areas: ${result.areas?.join(', ')||'?'} desc: ${result.desc||'?'}`);
        handleIsraelAlerts(result).catch(() => {});
        return;
      }
    } catch(e) { _logWarn('RedAlert', `✗ ${name}: ${e?.message || e}`); }
  }
  _logErr('RedAlert', `✗ All ${paths.length} paths failed (${(performance.now()-t0).toFixed(0)}ms)`);
}

let _standaloneRunning = false;
async function standaloneRefresh() {
  if (_standaloneRunning) return;
  _standaloneRunning = true;
  const t0 = performance.now();
  _log('Refresh', '=== Standalone refresh cycle START ===');
  try {
    await Promise.all([
      fetchPublicEarthquakes(), fetchPublicWeather(), fetchPublicMarine(), fetchPublicISS(),
      fetchPublicRedAlert(), fetchPublicSpaceWeather(), fetchPublicAviation(), fetchPublicShips(),
      fetchPublicSatellites(), fetchPublicDisasters(), fetchPublicFires(), fetchPublicEMSC(),
      fetchPublicGlobalAlerts()
    ]);
    refreshComposite();
    _log('Refresh', `=== Cycle DONE in ${(performance.now()-t0).toFixed(0)}ms | EQ:${live.earthquake?.items?.length||0} WX:${live.weather?.items?.length||0} Marine:${live.marine?.items?.length||0} Aviation:${live.aviation?.items?.length||0} Ships:${live.ships?.items?.length||0} Sats:${live.satellites?.items?.length||0} Disasters:${live.disasters?.items?.length||0} Fires:${live.fires?.items?.length||0} EMSC:${live.emsc_earthquakes?.items?.length||0} Alerts:${live.global_alerts?.items?.length||0} ===`);
  } catch(e) { _logErr('Refresh', `Cycle failed: ${e?.message||e}`); }
  _standaloneRunning = false;
}

async function prime() {
  const isGH = location.hostname.endsWith('github.io');
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  _log('Init', `═══ prime() START — host=${location.hostname} proto=${location.protocol} isGH=${isGH} isLocal=${isLocal} ═══`);

  // Always try local server first (unless GitHub Pages — server will never be there)
  if (!isGH) {
    _log('Init', `→ Trying server API: ${API}/data ...`);
    try {
      const t0 = performance.now();
      const [all, alerts, aiHist, aiNow] = await Promise.all([
        fetch(`${API}/data`, { signal: AbortSignal.timeout(5000) }).then(r => { _log('Init', `← /data HTTP ${r.status}`); return r.json(); }).catch(e => { _logWarn('Init', `✗ /data: ${e?.message||e}`); return null; }),
        fetch(`${API}/alerts?min_severity=2`, { signal: AbortSignal.timeout(5000) }).then(r => { _log('Init', `← /alerts HTTP ${r.status}`); return r.json(); }).catch(e => { _logWarn('Init', `✗ /alerts: ${e?.message||e}`); return null; }),
        fetch(`${API}/ai/history?limit=10`, { signal: AbortSignal.timeout(5000) }).then(r => { _log('Init', `← /ai/history HTTP ${r.status}`); return r.json(); }).catch(e => { _logWarn('Init', `✗ /ai/history: ${e?.message||e}`); return null; }),
        fetch(`${API}/ai/analysis`, { signal: AbortSignal.timeout(5000) }).then(r => { _log('Init', `← /ai/analysis HTTP ${r.status}`); return r.json(); }).catch(e => { _logWarn('Init', `✗ /ai/analysis: ${e?.message||e}`); return null; })
      ]);
      if (all && !all.error) {
        _log('Init', `✓ Server connected in ${(performance.now()-t0).toFixed(0)}ms → SERVER MODE`);
        absorbAllData(all);
        if (alerts && Array.isArray(alerts)) { aiAlerts = alerts.slice(0, 40); _log('Init', `✓ ${alerts.length} alerts loaded`); }
        refreshComposite();
        return;
      }
      _logWarn('Init', `Server returned error or null (${(performance.now()-t0).toFixed(0)}ms) → fallback to standalone`);
    } catch(e) { _logErr('Init', `Server connection failed: ${e?.message||e} → fallback to standalone`); }
  } else {
    _log('Init', 'GitHub Pages detected → standalone mode');
  }

  // Standalone mode (both GitHub Pages AND local without server)
  _standalone = true;
  _log('Init', `═══ STANDALONE MODE (${isGH ? 'GitHub Pages' : isLocal ? 'local no-server' : location.hostname}) ═══`);
  setConn(false);
  const connEl = $('conn');
  if (connEl) connEl.innerHTML = `STANDALONE${isGH ? ' (GH)' : ''} <span id="connDot" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:6px;background:#ff9100;box-shadow:0 0 10px rgba(255,145,0,.35)"></span>`;
  const aiLabel = document.querySelector('#aiPanel b');
  if (aiLabel) aiLabel.textContent = '📊 LOCAL MONITOR';
  await standaloneRefresh();
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('%c███ REALITY-CORE v38 — Starting... ███', 'color:#00e5ff;font-size:16px;font-weight:bold;text-shadow:0 0 8px #00e5ff');
  _log('Boot', `UA: ${navigator.userAgent.substring(0,80)}`);
  _log('Boot', `URL: ${location.href}`);
  if (typeof getApiStats === 'function') {
    const s = getApiStats();
    _log('Boot', `API Registry: ${s.total} APIs (${s.active} active, ${s.free} free, ${s.testable} testable)`);
  }
  initCesium();
  _log('Boot', '✓ Cesium initialized');
  setTimeout(initEntityClick, 2000);
  await prime();
  if (!_standalone) initWebSocket();
  // Auto QA quick check after 15s
  setTimeout(() => { if (typeof QA !== 'undefined') { _log('QA', '→ Running auto quick check...'); const r = QA.runQuick(); _log('QA', `✓ ${r.pass}/${r.total} passed (${r.percentage}%)`); } }, 15000);
  const _initSound = () => { window.soundSystem?.init(); ['click','keydown','touchstart','pointerdown'].forEach(e => document.removeEventListener(e, _initSound)); };
  ['click','keydown','touchstart','pointerdown'].forEach(e => document.addEventListener(e, _initSound, { once: true }));

  $('modeAuto')?.addEventListener('click', () => setMapMode('auto', false));
  $('modeIsrael')?.addEventListener('click', () => setMapMode('israel_flat', true));
  $('modeFlat')?.addEventListener('click', () => setMapMode('flat', true));
  $('modeGlobe')?.addEventListener('click', () => setMapMode('globe', true));
  $('mode3dToggle')?.addEventListener('click', () => {
    _israel3D = !_israel3D;
    setModeButtons();
    if (_mapMode === 'israel_flat') focusIsrael(0.6);
  });

  const depth = $('depthRange');
  if (depth) {
    depth.value = String(israelAlt);
    depth.oninput = () => {
      israelAlt = Number(depth.value) || israelAlt;
      if (_mapMode === 'israel_flat') focusIsrael(0.2);
      updateDepthReadout();
    };
    updateDepthReadout();
  }

  const areasBox = $('areas');
  if (areasBox) {
    areasBox.addEventListener('click', async (e) => {
      const row = e.target?.closest?.('.area');
      const idx = row ? Number(row.getAttribute('data-area-idx')) : NaN;
      if (!row || Number.isNaN(idx)) return;
      const nameEl = row.querySelector('.areaName');
      const area = nameEl ? nameEl.textContent : '';
      const geo = await getAreaGeo(area);
      if (geo) focusGeo(geo.lon, geo.lat, Math.min(israelAlt, 850000));
    });
  }

  renderHazardsPanel();
  renderAiPanel();

  $('aiCurrent')?.addEventListener('click', () => {
    const panel = $('aiPanel');
    if (panel) panel.classList.toggle('expanded');
  });
  $('aiHistory')?.addEventListener('click', (e) => {
    const item = e.target?.closest?.('.ai-item');
    if (!item) return;
    const idx = Number(item.getAttribute('data-ai-idx'));
    const allItems = [];
    aiAlerts.forEach(a => allItems.push(a));
    aiInsights.forEach(i => allItems.push({ ...i, summary: i.result?.summary, geo: i.result?.geo }));
    const target = allItems[idx];
    if (!target) return;
    const geo = getAiGeo(target);
    if (geo) {
      focusGeo(geo.lon, geo.lat, 2000000);
      flashEntityAt(geo.lon, geo.lat);
    }
  });

  $('wlToggle')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(); });
  $('wlAdd')?.addEventListener('click', () => {
    const inp = $('wlInput');
    if (inp?.value?.trim()) { addToWatchlist(inp.value.trim()); inp.value = ''; }
  });
  const wlInp = $('wlInput');
  if (wlInp) {
    wlInp.addEventListener('input', () => populateWlSuggestions(wlInp.value));
    wlInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && wlInp.value.trim()) { e.preventDefault(); addToWatchlist(wlInp.value.trim()); wlInp.value = ''; }
    });
  }
  $('wlList')?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.wl-rm');
    if (btn) removeFromWatchlist(btn.getAttribute('data-wl'));
  });
  renderWatchlistUI();
  loadAreaMeta().catch(() => {});
});

setInterval(() => {
  refreshComposite();
}, 1500);

setInterval(() => {
  if (_standalone) standaloneRefresh();
}, 180000);
