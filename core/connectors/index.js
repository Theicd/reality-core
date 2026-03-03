const USGSConnector = require('./USGSConnector');
const OpenMeteoConnector = require('./OpenMeteoConnector');
const OpenSkyConnector = require('./OpenSkyConnector');
const NOAASpaceConnector = require('./NOAASpaceConnector');
const NOAABuoysConnector = require('./NOAABuoysConnector');
const CelesTrakConnector = require('./CelesTrakConnector');
const ShipAISConnector = require('./ShipAISConnector');
const RedAlertILConnector = require('./RedAlertILConnector');
const ISSConnector = require('./ISSConnector');
const SolarSystemConnector = require('./SolarSystemConnector');
const TzevaAdomConnector = require('./TzevaAdomConnector');

const connectors = {
  usgs: new USGSConnector(),
  openMeteo: new OpenMeteoConnector(),
  openSky: new OpenSkyConnector(),
  noaaSpace: new NOAASpaceConnector(),
  noaaBuoys: new NOAABuoysConnector(),
  celestrak: new CelesTrakConnector(),
  shipAIS: new ShipAISConnector(),
  redAlertIL: new RedAlertILConnector(),
  iss: new ISSConnector(),
  solarSystem: new SolarSystemConnector(),
  ...((String(process.env.TZEVAADOM_PREALERT || '1').toLowerCase() === '0' || String(process.env.TZEVAADOM_PREALERT || '1').toLowerCase() === 'false') ? {} : { tzevaAdom: new TzevaAdomConnector() })
};

async function startAll() {
  for (const [name, conn] of Object.entries(connectors)) {
    try { await conn.start(); } catch (e) { console.error(`Failed to start ${name}:`, e.message); }
  }
}

function stopAll() {
  for (const conn of Object.values(connectors)) conn.stop();
}

function getStatuses() {
  return Object.values(connectors).map(c => c.getStatus());
}

module.exports = { connectors, startAll, stopAll, getStatuses };
