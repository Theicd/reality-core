/**
 * icon-engine.js — Clear labeled icons & animations for map markers
 */

function _badge(emoji, bg, border, size, anim) {
  const s = size || 28;
  const a = anim ? `;animation:${anim}` : '';
  return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${bg};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:${Math.round(s*.5)}px;box-shadow:0 0 ${Math.round(s*.4)}px ${border}${a}">${emoji}</div>`;
}

const ICONS = {
  earthquake: (mag) => {
    const s = Math.max(20, Math.min(44, mag * 7));
    const c = mag >= 6 ? '#ff1744' : mag >= 4.5 ? '#ff6d00' : mag >= 3 ? '#ffab00' : '#ffd600';
    return `<div style="position:relative;width:${s}px;height:${s}px">
      <div style="width:100%;height:100%;border-radius:50%;background:${c}30;border:2px solid ${c};box-shadow:0 0 ${s}px ${c};animation:pulse-ring 1.5s infinite"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:${Math.round(s*.45)}px;font-weight:700;color:#fff;text-shadow:0 0 4px #000">${mag?.toFixed?.(1) || '?'}</div>
    </div>`;
  },

  volcano: () => _badge('🌋', '#4a148c40', '#ff6d00', 30, 'blink 2s infinite'),

  weather: (type) => {
    const cfg = {
      rain:    { e: '🌧', bg: '#0d47a140', bc: '#42a5f5' },
      storm:   { e: '⛈', bg: '#1a237e50', bc: '#7c4dff', a: 'blink .8s infinite' },
      tornado: { e: '🌪', bg: '#4a148c40', bc: '#e040fb', a: 'blink 1s infinite' },
      snow:    { e: '❄', bg: '#e3f2fd40', bc: '#90caf9' },
      flood:   { e: '🌊', bg: '#01579b40', bc: '#29b6f6' },
      clear:   { e: '☀', bg: '#f57f1730', bc: '#ffb300' },
      cloud:   { e: '☁', bg: '#37474f40', bc: '#78909c' },
      hot:     { e: '🔥', bg: '#b7141830', bc: '#ff1744', a: 'blink 1.5s infinite' }
    };
    const c = cfg[type] || { e: '🌡', bg: '#26323840', bc: '#546e7a' };
    return _badge(c.e, c.bg, c.bc, 28, c.a);
  },

  fire: () => _badge('🔥', '#bf360c40', '#ff3d00', 22, 'blink .7s infinite'),

  aircraft: (hdg = 0) => `<div style="font-size:18px;transform:rotate(${hdg}deg);filter:drop-shadow(0 0 4px #ffd600);line-height:1">✈️</div>`,

  ship: (type) => {
    const isT = typeof type === 'number';
    const e = isT ? (type >= 80 ? '⛽' : type >= 70 ? '📦' : type >= 60 ? '🛳' : type === 35 ? '⚓' : '🚢') :
      (type === 'tanker' ? '⛽' : type === 'cargo' ? '📦' : type === 'passenger' ? '🛳' : '🚢');
    return _badge(e, '#00695c30', '#26a69a', 22);
  },

  satellite: () => _badge('🛰', '#311b9240', '#7c4dff', 20),
  iss: () => _badge('🛰', '#1a237e50', '#00e5ff', 32, 'blink 2s infinite'),

  alert_rocket: () => _badge('🚀', '#ff174440', '#ff1744', 30, 'pulse-ring 1s infinite'),
  alert_drone: () => _badge('⚠', '#ff6d0040', '#ff6d00', 26, 'blink 1.2s infinite'),
  alert_missile: () => _badge('💥', '#ff174460', '#ff1744', 34, 'pulse-ring .7s infinite'),

  radiation: () => _badge('☢', '#ff6f0030', '#ff6f00', 24),
  solar: () => _badge('☀', '#ff6f0020', '#ffab00', 26),

  disaster: (type) => {
    const cfg = {
      wildfire: { e: '🔥', bg: '#bf360c40', bc: '#ff3d00' },
      storm:    { e: '🌪', bg: '#1a237e40', bc: '#7c4dff' },
      flood:    { e: '🌊', bg: '#01579b40', bc: '#29b6f6' },
      drought:  { e: '🏜', bg: '#e6510040', bc: '#ffab00' },
      ice:      { e: '🧊', bg: '#e3f2fd40', bc: '#90caf9' },
      EQ:       { e: '🌍', bg: '#ff974440', bc: '#ff9100' },
      TC:       { e: '🌀', bg: '#1a237e40', bc: '#448aff' },
      FL:       { e: '🌊', bg: '#01579b40', bc: '#29b6f6' },
      VO:       { e: '🌋', bg: '#4a148c40', bc: '#ff6d00' }
    };
    const c = cfg[type] || { e: '⚠', bg: '#ff6f0030', bc: '#ffab00' };
    return _badge(c.e, c.bg, c.bc, 26);
  }
};

function getMarkerIcon(type, data) {
  const fn = ICONS[type];
  if (!fn) return `<div style="font-size:14px">📍</div>`;
  return fn(data);
}

// Legend builder — call from page to add legend overlay on map
function buildLegend(items) {
  // items: [{icon, label, color}]
  let html = '<div style="position:absolute;bottom:10px;left:10px;z-index:800;background:rgba(22,27,34,.92);border:1px solid #30363d;border-radius:8px;padding:8px 10px;font-size:11px;max-width:200px">';
  html += '<div style="font-weight:600;color:#8b949e;margin-bottom:4px">מקרא</div>';
  for (const it of items) {
    html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="font-size:14px">${it.icon}</span><span style="color:${it.color || '#e0e0e0'}">${it.label}</span></div>`;
  }
  html += '</div>';
  return html;
}
