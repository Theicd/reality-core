/**
 * icon-engine.js — Icons & animations for map markers
 */

const ICONS = {
  earthquake: (mag) => {
    const s = Math.max(16, Math.min(40, mag * 6));
    const c = mag >= 6 ? '#ff1744' : mag >= 4 ? '#ff9100' : '#ffd600';
    return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${c};opacity:.8;border:2px solid ${c};box-shadow:0 0 ${s}px ${c};animation:pulse-ring 1.5s infinite"></div>`;
  },
  volcano: () => `<div style="font-size:20px;filter:drop-shadow(0 0 4px #ff6d00)">🌋</div>`,
  weather: (type) => {
    const map = { rain: '🌧', storm: '🌩', tornado: '🌪', snow: '❄', flood: '🌊', clear: '☀', cloud: '☁', hot: '🔥' };
    return `<div style="font-size:18px">${map[type] || '🌡'}</div>`;
  },
  fire: () => `<div style="font-size:16px;animation:blink .8s infinite">🔥</div>`,
  aircraft: (hdg = 0) => `<div style="font-size:16px;transform:rotate(${hdg}deg);filter:drop-shadow(0 0 3px #ffd600)">✈</div>`,
  ship: (type) => {
    const icon = type === 'tanker' ? '🛢' : type === 'cargo' ? '📦' : '🚢';
    return `<div style="font-size:16px">${icon}</div>`;
  },
  satellite: () => `<div style="font-size:14px;filter:drop-shadow(0 0 4px #7c4dff)">🛰</div>`,
  iss: () => `<div style="font-size:20px;filter:drop-shadow(0 0 8px #00e5ff)">🛰</div>`,
  alert_rocket: () => `<div style="width:24px;height:24px;border-radius:50%;background:rgba(255,23,68,.3);border:2px solid #ff1744;animation:pulse-ring 1s infinite;display:flex;align-items:center;justify-content:center;font-size:14px">🚀</div>`,
  alert_drone: () => `<div style="font-size:18px;animation:blink 1.2s infinite">⚠</div>`,
  alert_missile: () => `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,23,68,.5);border:3px solid #ff1744;animation:pulse-ring .7s infinite;display:flex;align-items:center;justify-content:center;font-size:16px">💥</div>`,
  radiation: () => `<div style="font-size:16px">☢</div>`,
  solar: () => `<div style="font-size:18px;filter:drop-shadow(0 0 6px #ffab00)">☀</div>`,
  disaster: (type) => {
    const map = { wildfire: '🔥', storm: '🌪', flood: '🌊', drought: '🏜', ice: '🧊' };
    return `<div style="font-size:18px">${map[type] || '⚠'}</div>`;
  }
};

function getMarkerIcon(type, data) {
  const fn = ICONS[type];
  if (!fn) return `<div style="font-size:14px">📍</div>`;
  return fn(data);
}
