const axios = require('axios');
const WebSocket = require('ws');
const logger = require('../logger');
const eventBus = require('../events/eventBus');

const WS_URL = 'wss://ws.tzevaadom.co.il/socket?platform=WEB';
const ORIGIN = 'https://www.tzevaadom.co.il';
const PRE_ALERT_TITLE = 'בדקות הקרובות צפויות להתקבל התרעות באזורך';
const MAP_URL = 'https://raw.githubusercontent.com/amitfin/oref_alert/main/custom_components/oref_alert/metadata/tzevaadom_id_to_area.py';
const OREF_CITIES_MIX_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx';
const SPELLING_FIX = {
  'אשדוד -יא,יב,טו,יז,מרינה,סיט': 'אשדוד -יא,יב,טו,יז,מרינה,סיטי'
};

const ISRAEL_GEO = { lat: 31.7683, lon: 35.2137 };

class TzevaAdomConnector {
  constructor() {
    this.name = 'TzevaAdom';
    this.running = false;
    this.status = 'idle';
    this.lastFetch = null;
    this._ws = null;
    this._reconnectT = null;
    this._heartbeatT = null;
    this._clearT = null;
    this._idToArea = new Map();
    this._lastSig = '';
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.status = 'starting';
    this._ensureMap();
    this._connect();
    logger.info(`[${this.name}] Started`);
  }

  stop() {
    this.running = false;
    this.status = 'stopped';
    if (this._reconnectT) clearTimeout(this._reconnectT);
    if (this._heartbeatT) clearInterval(this._heartbeatT);
    if (this._clearT) clearTimeout(this._clearT);
    this._reconnectT = null;
    this._heartbeatT = null;
    this._clearT = null;
    try { this._ws?.close(); } catch (_) {}
    this._ws = null;
    logger.info(`[${this.name}] Stopped`);
  }

  getStatus() {
    return { name: this.name, status: this.status, lastFetch: this.lastFetch, retryCount: 0 };
  }

  publish(type, data) {
    return eventBus.publish(type, data, this.name);
  }

  async _ensureMap() {
    if (this._idToArea.size) return;
    try {
      const res = await axios.get(MAP_URL, { responseType: 'text', timeout: 12000 });
      const text = typeof res.data === 'string' ? res.data : String(res.data || '');
      const re = /(\d+)\s*:\s*(?:"([^"]+)"|'([^']+)')/g;
      let m;
      while ((m = re.exec(text))) {
        const id = Number(m[1]);
        const raw = (m[2] ?? m[3] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (!Number.isNaN(id) && raw) this._idToArea.set(id, raw);
      }

      if (this._idToArea.size < 100) throw new Error('map too small');
      this.lastFetch = new Date().toISOString();
      logger.info(`[${this.name}] Loaded area map (${this._idToArea.size})`);
    } catch (e) {
      try {
        const res = await axios.get(OREF_CITIES_MIX_URL, { timeout: 20000 });
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.forEach(r => {
          const id = Number(r?.id);
          const name = r?.label_he || r?.label;
          if (!Number.isNaN(id) && name) this._idToArea.set(id, String(name));
        });
        this.lastFetch = new Date().toISOString();
        logger.info(`[${this.name}] Loaded area map (oref) (${this._idToArea.size})`);
      } catch (e2) {
        this.status = 'degraded';
        logger.error(`[${this.name}] Failed loading map: ${e.message}`);
      }
    }
  }

  _connect() {
    if (!this.running) return;
    try {
      this._ws = new WebSocket(WS_URL, { headers: { Origin: ORIGIN } });

      this._ws.on('open', () => {
        this.status = 'ok';
        if (this._heartbeatT) clearInterval(this._heartbeatT);
        this._heartbeatT = setInterval(() => {
          try { this._ws?.ping(); } catch (_) {}
        }, 45000);
      });

      this._ws.on('message', (buf) => {
        try {
          const msg = JSON.parse(buf.toString('utf8'));
          this._onMsg(msg);
        } catch (_) {}
      });

      this._ws.on('close', () => this._scheduleReconnect());
      this._ws.on('error', () => this._scheduleReconnect());
    } catch (e) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (!this.running) return;
    this.status = 'degraded';
    if (this._reconnectT) return;
    if (this._heartbeatT) clearInterval(this._heartbeatT);
    this._heartbeatT = null;
    this._reconnectT = setTimeout(() => {
      this._reconnectT = null;
      this._connect();
    }, 6000);
  }

  _areaFromId(id) {
    const a = this._idToArea.get(id);
    if (!a) return `#${id}`;
    return SPELLING_FIX[a] || a;
  }

  _publishClear() {
    this._lastSig = '';
    this.publish('israel_alerts', {
      id: `ta-clear-${Date.now()}`,
      active: false,
      count: 0,
      areas: [],
      items: [],
      source: 'tzevaadom',
      geo: ISRAEL_GEO,
      timestamp: new Date().toISOString()
    });
  }

  _onMsg(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type !== 'SYSTEM_MESSAGE') return;

    const d = msg.data || {};
    if (d.instructionType !== 0) return;

    const ids = Array.isArray(d.citiesIds) ? d.citiesIds : [];
    const areas = ids.map(x => this._areaFromId(Number(x))).filter(Boolean);
    if (!areas.length) return;

    const when = d.time ? new Date(Number(d.time) * 1000).toISOString() : new Date().toISOString();
    const id = d.notificationId ? `ta-${String(d.notificationId)}` : `ta-${Date.now()}`;
    const sig = `${id}|${areas.join('|')}`;
    if (sig === this._lastSig) return;
    this._lastSig = sig;

    const items = areas.map((area, idx) => ({
      id: `${id}-${idx}`,
      area,
      title: PRE_ALERT_TITLE,
      category: 14,
      alertDate: when,
      geo: ISRAEL_GEO
    }));

    const preview = areas.slice(0, 4).join(', ');
    const suffix = areas.length > 4 ? ` (+${areas.length - 4} more)` : '';
    const summary = `Pre-Alert: ${preview}${suffix}`;

    this.publish('israel_alerts', {
      id,
      active: true,
      title: PRE_ALERT_TITLE,
      category: 14,
      severity: 3,
      count: areas.length,
      areas,
      items,
      geo: ISRAEL_GEO,
      source: 'tzevaadom',
      summary,
      timestamp: when
    });

    if (this._clearT) clearTimeout(this._clearT);
    this._clearT = setTimeout(() => this._publishClear(), 6 * 60 * 1000);
  }
}

module.exports = TzevaAdomConnector;
