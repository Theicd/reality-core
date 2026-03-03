const axios = require('axios');
const BaseConnector = require('./BaseConnector');
const config = require('../config');
const logger = require('../logger');

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/',
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/json'
};

const ISRAEL_GEO = { lat: 31.7683, lon: 35.2137 };

class RedAlertILConnector extends BaseConnector {
  constructor() {
    super('RedAlertIL', config.apis.redAlertIL);
    this.lastSignature = '';
    this.lastActiveId = '';
    this.hasPublishedState = false;
  }

  async poll() {
    try {
      const current = await this.fetchCurrent();
      if (!current) {
        this.lastSignature = '';
        if (!this.hasPublishedState || this.lastActiveId) {
          this.lastActiveId = '';
          this.publish('israel_alerts', {
            id: `il-clear-${Date.now()}`,
            active: false,
            count: 0,
            areas: [],
            items: [],
            source: 'oref',
            geo: ISRAEL_GEO,
            timestamp: new Date().toISOString()
          });
          this.hasPublishedState = true;
        }
        return;
      }

      const areas = Array.isArray(current.data) ? current.data.filter(Boolean) : [];
      if (!areas.length) return;

      const signature = `${current.cat || ''}|${current.title || ''}|${areas.join('|')}`;
      if (signature === this.lastSignature) return;
      this.lastSignature = signature;

      const nowIso = new Date().toISOString();
      const id = `il-${Date.now()}`;
      this.lastActiveId = id;

      const title = String(current.title || 'Pikud HaOref Alert');
      const category = Number(current.cat || 0);
      const severity = this.mapSeverity(category);
      const desc = current.desc ? String(current.desc) : undefined;
      const duration = current.duration !== undefined ? Number(current.duration) : undefined;
      const orefId = current.id !== undefined ? String(current.id) : undefined;
      const dataCount = current.data_count !== undefined ? Number(current.data_count) : undefined;
      const items = areas.map((area, idx) => ({
        id: `${id}-${idx}`,
        area,
        title,
        category,
        alertDate: nowIso,
        desc,
        duration,
        orefId,
        geo: ISRAEL_GEO
      }));

      const preview = areas.slice(0, 4).join(', ');
      const suffix = areas.length > 4 ? ` (+${areas.length - 4} more)` : '';
      const summary = `Pikud HaOref: ${title} | ${preview}${suffix}`;

      const payload = {
        id,
        orefId,
        active: true,
        title,
        category,
        severity,
        count: areas.length,
        data_count: dataCount,
        areas,
        items,
        geo: ISRAEL_GEO,
        source: 'oref',
        summary,
        desc,
        duration,
        timestamp: nowIso
      };

      this.hasPublishedState = true;
      this.publish('israel_alerts', payload);
      this.publish('alert', {
        id: `alert-${id}`,
        category: 'ISRAEL RED ALERT',
        severity,
        confidence: 0.99,
        geo: ISRAEL_GEO,
        summary,
        recommended_action: 'Seek immediate shelter and follow official instructions',
        timestamp: nowIso
      });
    } catch (err) {
      this.status = 'error';
      logger.error(`[${this.name}] Poll failed: ${err.message}`);
    }
  }

  async fetchCurrent() {
    const url = `${this.url}/Alerts.json`;
    logger.info(`[${this.name}] Fetching: ${url}`);
    const res = await axios.get(url, {
      headers: OREF_HEADERS,
      responseType: 'text',
      timeout: 12000,
      validateStatus: (s) => s >= 200 && s < 500
    });

    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

    this.lastFetch = new Date().toISOString();
    this.status = 'ok';

    const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
    const cleaned = raw.replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim();
    if (!cleaned || cleaned === '{}' || cleaned === '[]' || cleaned === 'null') return null;

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`invalid JSON payload`);
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.data)) return null;
    return parsed;
  }

  mapSeverity(category) {
    if (category === 14) return 3;
    if ([1, 2, 3].includes(category)) return 5;
    return 4;
  }
}

module.exports = RedAlertILConnector;
