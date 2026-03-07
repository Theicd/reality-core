/**
 * map-core.js — Shared Leaflet map initialization
 * Dark theme, responsive, with layer controls
 */

let MAP = null;
const MAP_LAYERS = {};

function initMap(containerId = 'map', opts = {}) {
  const center = opts.center || [32.08, 34.78];
  const zoom = opts.zoom || 3;

  MAP = L.map(containerId, {
    center, zoom, zoomControl: true, attributionControl: false,
    maxZoom: 18, minZoom: 2, worldCopyJump: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19
  }).addTo(MAP);

  L.control.attribution({ position: 'bottomleft', prefix: 'Reality-Core' }).addTo(MAP);
  setTimeout(() => MAP.invalidateSize(), 200);
  return MAP;
}

function addLayerGroup(name) {
  if (MAP_LAYERS[name]) return MAP_LAYERS[name];
  const lg = L.layerGroup().addTo(MAP);
  MAP_LAYERS[name] = lg;
  return lg;
}

function clearLayer(name) {
  if (MAP_LAYERS[name]) MAP_LAYERS[name].clearLayers();
}

function toggleLayer(name, visible) {
  const lg = MAP_LAYERS[name];
  if (!lg) return;
  if (visible) { if (!MAP.hasLayer(lg)) MAP.addLayer(lg); }
  else { MAP.removeLayer(lg); }
}

function addCircleMarker(layer, lat, lon, opts = {}) {
  return L.circleMarker([lat, lon], {
    radius: opts.radius || 6, color: opts.color || '#00e5ff',
    fillColor: opts.fillColor || opts.color || '#00e5ff',
    fillOpacity: opts.fillOpacity || 0.7, weight: opts.weight || 1
  }).bindPopup(opts.popup || '').addTo(MAP_LAYERS[layer] || MAP);
}

function addIconMarker(layer, lat, lon, html, opts = {}) {
  const icon = L.divIcon({
    html, className: 'custom-marker', iconSize: [opts.size || 24, opts.size || 24],
    iconAnchor: [(opts.size || 24) / 2, (opts.size || 24) / 2]
  });
  return L.marker([lat, lon], { icon })
    .bindPopup(opts.popup || '')
    .addTo(MAP_LAYERS[layer] || MAP);
}

function fitBounds(bounds, pad = 0.5) {
  if (bounds && MAP) MAP.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
}
