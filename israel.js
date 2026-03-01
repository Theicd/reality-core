const API = `${location.origin}/api`;
const _PROXY = '';  // Set to your Cloudflare Worker URL, e.g. 'https://my-proxy.workers.dev'

let ws = null;
let viewer = null;

const ISRAEL_VIEW_3D = { lon: 35.2137, lat: 31.7683 };
let israelAlt = 750000;

let lastAlertId = '';
let pulsePrims = [];
let _lastActiveAreas = [];
let globalMarks = [];
let _globalSig = '';
let _preferOrefUntil = 0;

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
  iss: (c) => `<rect x="10" y="20" width="28" height="8" rx="3" fill="${c}" stroke="#000" stroke-width="1"/><rect x="4" y="16" width="8" height="16" rx="1" fill="${c}" opacity="0.6"/><rect x="36" y="16" width="8" height="16" rx="1" fill="${c}" opacity="0.6"/><circle cx="24" cy="24" r="4" fill="#fff" stroke="${c}" stroke-width="1.5"/>`
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
  const key = `wavebar_${height.toFixed(1)}_${color}`;
  if (_iconCache[key]) return _iconCache[key];
  const w = 40, h = 80;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const barH = Math.min(70, Math.max(8, height * 10));
  ctx.fillStyle = '#111'; ctx.fillRect(8, h-barH-4, w-16, barH);
  const grad = ctx.createLinearGradient(0, h, 0, h-barH);
  grad.addColorStop(0, color); grad.addColorStop(1, color + '60');
  ctx.fillStyle = grad; ctx.fillRect(10, h-barH-2, w-20, barH-2);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(8, h-barH-4, w-16, barH);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(height.toFixed(1)+'m', w/2, h-barH-10);
  _iconCache[key] = c.toDataURL();
  return _iconCache[key];
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

function showToast(text) {
  const toast = $('toast');
  const t = $('toastText');
  if (!toast || !t) return;
  t.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 4500);
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

function addPulseAt(lon, lat, colorCss = '#ff1744', areaName = '', isClear = false) {
  if (!viewer) return;
  const color = Cesium.Color.fromCssColorString(colorCss);
  const icon = makeSvgIcon('alert', 24, colorCss);
  const emoji = isClear ? '✅' : '🔴';

  const marker = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    billboard: { image: icon, width: 42, height: 42 },
    ellipse: { semiMajorAxis: 15000, semiMinorAxis: 15000, material: Cesium.Color.TRANSPARENT, outline: true, outlineColor: color.withAlpha(0.6), outlineWidth: 3 },
    label: areaName ? { text: `${emoji} ${areaName}`, font: 'bold 15px Rajdhani', fillColor: color, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(26, 0), showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.85) } : undefined
  });
  pulsePrims.push(marker);

  const start = performance.now();
  const pulse = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    ellipse: {
      semiMajorAxis: new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 1.5) / 1.5; return 12000 + k * 80000; }, false),
      semiMinorAxis: new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 1.5) / 1.5; return 12000 + k * 80000; }, false),
      material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 1.5) / 1.5; return color.withAlpha(0.4 * (1 - k)); }, false)),
      outline: true,
      outlineColor: new Cesium.CallbackProperty(() => { const k = ((performance.now() - start) / 1000 % 1.5) / 1.5; return color.withAlpha(0.8 * (1 - k)); }, false),
      height: 0
    }
  });
  pulsePrims.push(pulse);
}

function addPointAt(lon, lat, colorCss, label) {
  if (!viewer) return null;
  const col = Cesium.Color.fromCssColorString(colorCss);
  const e = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    point: { pixelSize: 7, color: col, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
    label: label ? { text: label, font: 'bold 13px Rajdhani', fillColor: col, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(10, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000) } : undefined
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
  planes.forEach(p => {
    const alt = p.altitude || p.geo.alt || 10000;
    const e = viewer?.entities?.add?.({
      position: Cesium.Cartesian3.fromDegrees(p.geo.lon, p.geo.lat, alt),
      billboard: { image: planeIcon, width: 44, height: 44, rotation: p.heading ? -Cesium.Math.toRadians(p.heading) : 0 },
      label: { text: `${p.callsign || p.icao24 || ''} ${p.country || ''}`, font: 'bold 14px Rajdhani', fillColor: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(26, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000) }
    });
    if (e) { e._rcType = 'aviation'; e._rcData = p; trafficMarks.push(e); }
    if (p.heading !== undefined) {
      const hdg = (p.heading || 0) * Math.PI / 180;
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
  ships.forEach(s => {
    const st = s.shipType || 0;
    const isBig = st >= 70 && st <= 79;
    const isMed = st >= 60 && st <= 69;
    const icon = isBig ? shipLarge : isMed ? shipMed : shipSmall;
    const sz = isBig ? 36 : isMed ? 28 : 22;
    const e = viewer?.entities?.add?.({
      position: Cesium.Cartesian3.fromDegrees(s.geo.lon, s.geo.lat, 0),
      billboard: { image: icon, width: sz, height: sz, rotation: s.heading ? -Cesium.Math.toRadians(s.heading) : 0 },
      label: { text: s.name || '', font: `bold ${isBig ? 14 : 12}px Rajdhani`, fillColor: Cesium.Color.fromCssColorString('#00bfa5'), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(sz/2 + 6, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isBig ? 5000000 : 2500000) }
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

    if (live.iss?.geo && !over.some(x => /ISS|ZARYA|25544/i.test(x.item.name || ''))) {
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
  const topEq = eqNear[0];
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
  const topWave = [...marineNear].sort((a, b) => (n(b.waveHeight) || 0) - (n(a.waveHeight) || 0))[0];
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
        label: { text: `RICHTER ${mag.toFixed(2)}\n${cut(x.place || '', 25)}`, font: 'bold 14px Rajdhani', fillColor: Cesium.Color.fromCssColorString(sevCol), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(iconSize/2 + 8, 0), showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#111').withAlpha(0.9) }
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
        label: { text: `${w.city || ''} ${Math.round(temp)}°C`, font: 'bold 14px Rajdhani', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(12, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6000000), showBackground: true, backgroundColor: Cesium.Color.fromCssColorString(col).withAlpha(0.3) }
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

  if (_seenAnomalies.size > 200) { const arr = [..._seenAnomalies]; _seenAnomalies.clear(); arr.slice(-80).forEach(k => _seenAnomalies.add(k)); }
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
  handler.setInputAction(click => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?._rcData) showInfoPopup(picked.id._rcData, picked.id._rcType);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
function closePopup() { $('info-popup')?.classList.add('hidden'); }
function showInfoPopup(d, type) {
  const el = $('info-popup');
  const content = $('info-popup-content');
  if (!el || !content) return;
  el.classList.remove('hidden');
  let html = '';
  if (type === 'earthquake') {
    const mag = Number(d.magnitude || 0);
    const sev = mag >= 8 ? 'קיצוני' : mag >= 7 ? 'חמור מאוד' : mag >= 6 ? 'חזק' : mag >= 5 ? 'בינוני' : mag >= 4 ? 'קל' : 'מינורי';
    const sevColor = mag >= 6 ? '#ff1744' : mag >= 4.5 ? '#ff9100' : '#ffd600';
    const tsunami = mag >= 6.5 && (d.depth || 999) < 70 ? 'גבוה' : mag >= 6 ? 'בינוני' : 'נמוך';
    const tsuCol = tsunami === 'גבוה' ? '#ff1744' : tsunami === 'בינוני' ? '#ff9100' : '#00ff88';
    html = `<div style="text-align:center;font-family:Orbitron;font-size:36px;font-weight:900;color:${sevColor};margin-bottom:6px">RICHTER ${mag.toFixed(2)}</div>
      <div style="text-align:center;font-size:18px;margin-bottom:10px;color:${sevColor};font-family:Orbitron;letter-spacing:2px">${sev}</div>
      <div style="text-align:center;font-size:18px;margin-bottom:14px">${d.place || 'לא ידוע'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px;margin-bottom:10px">
      <span style="color:var(--text2)">עומק</span><span>${d.depth || '?'} km</span>
      <span style="color:var(--text2)">סיכון צונאמי</span><span style="color:${tsuCol}">${tsunami}</span>
      <span style="color:var(--text2)">זמן</span><span>${d.time ? new Date(d.time).toLocaleString() : '?'}</span>
      <span style="color:var(--text2)">קואורדינטות</span><span>${d.geo?.lat?.toFixed(3) || '?'} / ${d.geo?.lon?.toFixed(3) || '?'}</span></div>
      <div style="font-size:13px;line-height:1.5;color:var(--text2);border-top:1px solid rgba(255,255,255,.12);padding-top:8px">
        מדריך ריכטר: 4.0+ מורגש | 5.0+ סיכון מבני | 6.5+ פוטנציאל צונאמי אם רדוד.
      </div>`;
  } else if (type === 'weather') {
    const t = d.temperature, w = d.windspeed || 0;
    const col = t > 35 ? '#ff1744' : t > 25 ? '#ff9100' : t > 15 ? '#ffd600' : t > 5 ? '#00e5ff' : '#2196f3';
    html = `<div style="text-align:center;font-family:Orbitron;font-size:32px;font-weight:900;color:${col};margin-bottom:8px">${Math.round(t)}°C</div>
      <div style="text-align:center;font-size:20px;margin-bottom:14px">${d.city || 'לא ידוע'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px">
      <span style="color:var(--text2)">טמפרטורה</span><span style="color:${col}">${t}°C</span>
      <span style="color:var(--text2)">רוח</span><span>${Math.round(w)} km/h</span>
      <span style="color:var(--text2)">קואורדינטות</span><span>${d.geo?.lat?.toFixed(2) || '?'}, ${d.geo?.lon?.toFixed(2) || '?'}</span>
      ${d.humidity !== undefined ? `<span style="color:var(--text2)">לחות</span><span>${d.humidity}%</span>` : ''}
      </div>`;
  } else if (type === 'marine') {
    const wh = parseFloat(d.waveHeight) || 0;
    const col = wh > 4 ? '#ff1744' : wh > 2 ? '#ff9100' : '#00bcd4';
    html = `<div style="text-align:center;font-family:Orbitron;font-size:32px;font-weight:900;color:${col};margin-bottom:8px">${wh.toFixed(1)}m גלים</div>
      <div style="text-align:center;font-size:18px;margin-bottom:14px">${d.station || 'תחנה ימית'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px">
      <span style="color:var(--text2)">גובה גלים</span><span style="color:${col}">${wh.toFixed(1)} m</span>
      <span style="color:var(--text2)">טמפ\' מים</span><span>${d.waterTemp || '?'}°C</span>
      <span style="color:var(--text2)">קואורדינטות</span><span>${d.geo?.lat?.toFixed(2) || '?'}, ${d.geo?.lon?.toFixed(2) || '?'}</span>
      </div>
      <div style="font-size:13px;line-height:1.5;color:var(--text2);border-top:1px solid rgba(255,255,255,.12);padding-top:8px;margin-top:10px">
        גלים מעל 2m: סכנה לשייט קטן | מעל 4m: אזהרה ימית כללית | מעל 6m: סופה ימית.
      </div>`;
  } else if (type === 'satellite' || type === 'iss') {
    const isISS = type === 'iss' || /ISS|ZARYA|25544/i.test(d.name || '');
    const col = isISS ? '#7c4dff' : '#4fc3f7';
    html = `<div style="text-align:center;font-family:Orbitron;font-size:24px;font-weight:900;color:${col};margin-bottom:8px">${isISS ? '🛰 ISS' : '◈ ' + (d.name || 'SAT')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px;margin-top:10px">
      <span style="color:var(--text2)">שם</span><span>${d.name || 'לא ידוע'}</span>
      ${d.noradId ? `<span style="color:var(--text2)">NORAD ID</span><span>${d.noradId}</span>` : ''}
      ${d.geo ? `<span style="color:var(--text2)">מיקום</span><span>${d.geo.lat?.toFixed(2) || '?'}°, ${d.geo.lon?.toFixed(2) || '?'}°</span>` : ''}
      ${d.altitude ? `<span style="color:var(--text2)">גובה</span><span>${Math.round(d.altitude)} km</span>` : ''}
      ${d.inclination ? `<span style="color:var(--text2)">הטיה</span><span>${d.inclination}°</span>` : ''}
      ${d.meanMotion ? `<span style="color:var(--text2)">סיבובים/יום</span><span>${parseFloat(d.meanMotion).toFixed(2)}</span>` : ''}
      </div>`;
  } else if (type === 'aviation') {
    html = `<div style="text-align:center;font-family:Orbitron;font-size:24px;font-weight:900;color:#ffd600;margin-bottom:8px">✈ ${d.callsign || d.icao24 || 'AIRCRAFT'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px;margin-top:10px">
      ${d.callsign ? `<span style="color:var(--text2)">קריאה</span><span>${d.callsign}</span>` : ''}
      ${d.country ? `<span style="color:var(--text2)">מדינה</span><span>${d.country}</span>` : ''}
      ${d.icao24 ? `<span style="color:var(--text2)">ICAO</span><span>${d.icao24}</span>` : ''}
      <span style="color:var(--text2)">גובה</span><span>${d.altitude || d.geo?.alt || '?'} m</span>
      ${d.heading !== undefined ? `<span style="color:var(--text2)">כיוון</span><span>${Math.round(d.heading)}°</span>` : ''}
      ${d.velocity !== undefined ? `<span style="color:var(--text2)">מהירות</span><span>${Math.round(d.velocity)} m/s</span>` : ''}
      <span style="color:var(--text2)">מיקום</span><span>${d.geo?.lat?.toFixed(3) || '?'}, ${d.geo?.lon?.toFixed(3) || '?'}</span>
      </div>`;
  } else if (type === 'ships') {
    html = `<div style="text-align:center;font-family:Orbitron;font-size:24px;font-weight:900;color:#00bfa5;margin-bottom:8px">⛴ ${d.name || 'VESSEL'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:15px;margin-top:10px">
      ${d.name ? `<span style="color:var(--text2)">שם</span><span>${d.name}</span>` : ''}
      ${d.mmsi ? `<span style="color:var(--text2)">MMSI</span><span>${d.mmsi}</span>` : ''}
      ${d.shipType ? `<span style="color:var(--text2)">סוג</span><span>TYPE ${d.shipType}</span>` : ''}
      ${d.heading !== undefined ? `<span style="color:var(--text2)">כיוון</span><span>${Math.round(d.heading)}°</span>` : ''}
      ${d.speed !== undefined ? `<span style="color:var(--text2)">מהירות</span><span>${d.speed} kn</span>` : ''}
      <span style="color:var(--text2)">מיקום</span><span>${d.geo?.lat?.toFixed(3) || '?'}, ${d.geo?.lon?.toFixed(3) || '?'}</span>
      </div>`;
  } else if (d._isAlert) {
    const col = d.severity >= 4 ? '#ff1744' : d.severity >= 3 ? '#ff9100' : '#ffd600';
    html = `<div style="text-align:center;font-family:Orbitron;font-size:30px;font-weight:900;color:${col};margin-bottom:8px">⚡ רמת התראה ${d.severity}</div>
      <div style="text-align:center;font-size:18px;margin-bottom:14px">${d.category || 'מערכת'}</div>
      <div style="font-size:16px;line-height:1.7;margin-bottom:12px">${d.summary || ''}</div>
      <div style="font-size:13px;color:var(--text2)">ביטחון: ${((d.confidence || 0) * 100).toFixed(0)}%</div>`;
  } else {
    html = `<div style="font-size:16px;line-height:1.5">${JSON.stringify(d, null, 2).replace(/\n/g, '<br>')}</div>`;
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

function renderAreas(allAreas, isPre = false, isClear = false) {
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
  const pillClass = isClear ? 'green' : (isPre ? 'amber' : 'red');
  const pillText = isClear ? 'CLEAR' : (isPre ? 'PRE' : 'RED');
  box.innerHTML = areas.map((a, i) => (
    `<div class="area" data-area-idx="${i}" style="cursor:pointer"><span class="pill ${pillClass}">${pillText}</span><span class="areaName">${escapeHtml(a)}</span><span class="pill" id="migun-${i}" style="margin-right:auto">${isClear ? '✅' : '---'}</span></div>`
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
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\u0027':'&#39;'}[c] || c));
}

async function handleIsraelAlerts(d) {
  if (!$('alertTime')) return;

  if (d?.source === 'tzevaadom' && Date.now() < _preferOrefUntil) return;

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
    if (hadActive) {
      if (head) { head.textContent = '✅ ניתן לצאת מהמרחב המוגן'; head.style.color = '#00e676'; }
      if (instr) instr.textContent = 'ההתרעה הסתיימה - ניתן לצאת בזהירות';
      const toastTitle = $('toastTitle');
      if (toastTitle) toastTitle.textContent = '✅ ניתן לצאת';
      const toastInner = $('toastInner');
      if (toastInner) {
        toastInner.style.borderColor = 'rgba(0,230,118,.55)';
        toastInner.style.background = 'rgba(0,230,118,.12)';
        toastInner.style.boxShadow = '0 0 32px rgba(0,230,118,.14)';
      }
      showToast('✅ ניתן לצאת מהמרחב המוגן');
      window.soundSystem?.alertInfo();
      renderAreas(_lastActiveAreas, false, true);
      _lastActiveAreas.forEach(async (a) => {
        const geo = await getAreaGeo(a);
        if (geo) addPulseAt(geo.lon, geo.lat, '#00e676', a, true);
      });
      setTimeout(() => { clearPulses(); renderAreas([]); _lastActiveAreas = []; if (head) { head.textContent = 'צבע אדום - ישראל'; head.style.color = 'var(--red)'; } if (instr) instr.textContent = ''; }, 300000);
    } else {
      if (head) { head.textContent = 'צבע אדום - ישראל'; head.style.color = 'var(--red)'; }
      if (instr) instr.textContent = '';
      const toastTitle = $('toastTitle');
      if (toastTitle) toastTitle.textContent = 'התראה נכנסת';
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

  const isPre = Number(d.category) === 14;
  if (d?.source === 'oref') _preferOrefUntil = Date.now() + 4 * 60 * 1000;
  const head = document.querySelector('#alertHead b');
  if (head) { head.textContent = isPre ? 'הנחיה מקדימה - ישראל' : 'צבע אדום - ישראל'; head.style.color = isPre ? 'var(--amber)' : 'var(--red)'; }
  const toastTitle = $('toastTitle');
  if (toastTitle) toastTitle.textContent = isPre ? 'הנחיה מקדימה' : 'התראה נכנסת';
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

  renderAreas(d.areas || [], isPre);

  const sig = `${d.id}|${_watchEnabled}|${[..._watchlist].join(',')}`;
  if (!d.id || sig === lastAlertId) return;
  lastAlertId = sig;

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
      addPulseAt(geo.lon, geo.lat, color, a);
    } else {
      const r1 = hash01(a);
      const r2 = hash01(a + 'x');
      const dLon = (r1 - 0.5) * 0.32;
      const dLat = (r2 - 0.5) * 0.22;
      addPulseAt(ISRAEL_VIEW_3D.lon + dLon, ISRAEL_VIEW_3D.lat + dLat, color, a);
    }
  });

  if (!areas.length) {
    renderHazardsPanel();
    return;
  }

  const firstGeo = await firstGeoPromise;
  if (firstGeo) focusGeo(firstGeo.lon, firstGeo.lat, Math.min(israelAlt, 900000));
  else if (_mapMode === 'auto' || _mapMode === 'israel_flat') focusIsrael();

  showToast(d.summary || (isPre ? 'הנחיה מקדימה' : 'התראת צבע אדום'));
  if (isPre) window.soundSystem?.alertInfo(); else window.soundSystem?.alertCritical();
  renderHazardsPanel();
}

function initWebSocket() {
  if (_standalone) return;
  try {
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${wsProto}://${location.host}/ws`);
    ws.onopen = () => {
      setConn(true);
      try { ws.send(JSON.stringify({ action: 'get_data' })); } catch(_) {}
      try { ws.send(JSON.stringify({ action: 'get_alerts' })); } catch(_) {}
    };
    ws.onclose = () => { setConn(false); if (!_standalone) setTimeout(initWebSocket, 3000); };
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
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
      } catch(e) {}
    };
  } catch(e) { if (!_standalone) setTimeout(initWebSocket, 3000); }
}

let _standalone = false;

async function fetchPublicEarthquakes() {
  try {
    const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
    const d = await r.json();
    if (!d?.features) return;
    live.earthquake = { timestamp: new Date().toISOString(), items: d.features.map(f => ({ id: f.id, magnitude: f.properties.mag, place: f.properties.place, time: f.properties.time, depth: f.geometry.coordinates[2], geo: { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] } })) };
  } catch(_) {}
}

async function fetchPublicWeather() {
  try {
    const cities = [
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
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current_weather=true`);
    const d = await r.json();
    const items = (Array.isArray(d) ? d : [d]).map((w, i) => {
      const cw = w.current_weather || {};
      return { city: cities[i]?.name || '', temperature: cw.temperature, windspeed: cw.windspeed, geo: { lat: cities[i]?.lat, lon: cities[i]?.lon } };
    }).filter(x => x.geo && x.temperature !== undefined);
    if (items.length) live.weather = { timestamp: new Date().toISOString(), items };
  } catch(_) {}
}

async function fetchPublicSatellites() {
  try {
    const text = await _corsFetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle', 10000);
    if (!text) return;
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
    if (items.length) live.satellites = { timestamp: new Date().toISOString(), items };
  } catch(_) {}
}

async function fetchPublicMarine() {
  try {
    const pts = [
      {lat:32.0,lon:34.2,n:'Med-TLV'},{lat:33.0,lon:34.0,n:'Med-Haifa'},{lat:29.5,lon:34.9,n:'RedSea-Eilat'},
      {lat:35.0,lon:18.0,n:'Med-Central'},{lat:36.0,lon:28.0,n:'Aegean'},{lat:34.0,lon:25.0,n:'Med-Crete'},
      {lat:41.0,lon:29.0,n:'BlackSea'},{lat:25.0,lon:37.0,n:'RedSea-N'},{lat:24.0,lon:55.0,n:'PersianGulf'},
      {lat:12.0,lon:45.0,n:'GulfAden'},{lat:40.0,lon:-30.0,n:'Atlantic-N'},{lat:35.0,lon:140.0,n:'Pacific-JP'},
      {lat:25.0,lon:-90.0,n:'GulfMexico'},{lat:55.0,lon:-5.0,n:'NorthSea'},{lat:10.0,lon:80.0,n:'Indian'},
      {lat:-35.0,lon:150.0,n:'Tasman'},{lat:0.0,lon:-25.0,n:'Atlantic-Eq'},{lat:-10.0,lon:50.0,n:'Indian-W'}
    ];
    const lats = pts.map(p=>p.lat).join(','), lons = pts.map(p=>p.lon).join(',');
    const r = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&current=wave_height,wave_period`);
    const d = await r.json();
    const arr = Array.isArray(d) ? d : [d];
    const items = arr.map((m, i) => {
      const wh = m?.current?.wave_height;
      if (!Number.isFinite(wh) || wh <= 0) return null;
      return { station: pts[i]?.n || `P${i}`, geo: { lat: pts[i].lat, lon: pts[i].lon }, waveHeight: wh, waterTemp: null };
    }).filter(Boolean);
    if (items.length) live.marine = { timestamp: new Date().toISOString(), items };
  } catch(_) {}
}

async function fetchPublicISS() {
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    const d = await r.json();
    if (d?.latitude && d?.longitude) live.iss = { geo: { lat: d.latitude, lon: d.longitude }, altitude: d.altitude };
  } catch(_) {}
}

async function _corsFetch(url, timeout = 10000) {
  const enc = encodeURIComponent(url);
  const attempts = [
    ..._PROXY ? [() => fetch(`${_PROXY}?url=${enc}`, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.text(); })] : [],
    () => fetch(`https://api.allorigins.win/get?url=${enc}`, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => j?.contents || ''),
    () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${enc}`, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.text(); }),
    () => fetch(url, { signal: AbortSignal.timeout(timeout) }).then(r => { if (!r.ok) throw 0; return r.text(); })
  ];
  for (const attempt of attempts) {
    try { const t = await attempt(); if (t && t.length > 1) return t; } catch(_) {}
  }
  return null;
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

async function fetchPublicRedAlert() {
  const tzeva = 'https://api.tzevaadom.co.il/notifications';
  const enc = encodeURIComponent(tzeva);
  const paths = [
    ..._PROXY ? [{ name: 'proxy', fn: () => fetch(`${_PROXY}?url=${enc}`, { signal: AbortSignal.timeout(6000) }).then(r => { if (!r.ok) throw 0; return r.text(); }) }] : [],
    { name: 'allorigins', fn: () => fetch(`https://api.allorigins.win/get?url=${enc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => j?.contents || '') },
    { name: 'codetabs', fn: () => fetch(`https://api.codetabs.com/v1/proxy/?quest=${enc}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw 0; return r.text(); }) },
    { name: 'direct', fn: () => fetch(tzeva, { signal: AbortSignal.timeout(5000) }).then(r => { if (!r.ok) throw 0; return r.text(); }) }
  ];
  for (const { name, fn } of paths) {
    try {
      const text = await fn();
      const result = _parseRedAlertResponse(text);
      if (result) {
        console.log(`[RedAlert] ✓ ${name} → active:${result.active}`);
        handleIsraelAlerts(result).catch(() => {});
        return;
      }
    } catch(e) { console.log(`[RedAlert] ✗ ${name}: ${e?.message || e}`); }
  }
  console.log('[RedAlert] all paths failed');
}

async function standaloneRefresh() {
  await Promise.all([fetchPublicEarthquakes(), fetchPublicWeather(), fetchPublicSatellites(), fetchPublicMarine(), fetchPublicISS(), fetchPublicRedAlert()]);
  refreshComposite();
  if (_standalone) setTimeout(standaloneRefresh, 30000);
}

async function prime() {
  if (!location.hostname.endsWith('github.io')) {
    try {
      const [all, alerts, aiHist, aiNow] = await Promise.all([
        fetch(`${API}/data`).then(r => r.json()).catch(() => null),
        fetch(`${API}/alerts?min_severity=2`).then(r => r.json()).catch(() => null),
        fetch(`${API}/ai/history?limit=10`).then(r => r.json()).catch(() => null),
        fetch(`${API}/ai/analysis`).then(r => r.json()).catch(() => null)
      ]);
      if (all && !all.error) { absorbAllData(all); refreshComposite(); return; }
    } catch(e) {}
  }
  _standalone = true;
  setConn(false);
  const connEl = $('conn');
  if (connEl) connEl.innerHTML = 'STANDALONE <span id="connDot" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:6px;background:#ff9100;box-shadow:0 0 10px rgba(255,145,0,.35)"></span>';
  const aiLabel = document.querySelector('#aiPanel b');
  if (aiLabel) aiLabel.textContent = '📊 LOCAL MONITOR';
  await standaloneRefresh();
}

document.addEventListener('DOMContentLoaded', async () => {
  initCesium();
  setTimeout(initEntityClick, 2000);
  await prime();
  if (!_standalone) initWebSocket();
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

let _lastStandaloneFetch = 0;
setInterval(() => {
  if (_standalone && Date.now() - _lastStandaloneFetch > 60000) {
    _lastStandaloneFetch = Date.now();
    standaloneRefresh();
  }
}, 10000);
