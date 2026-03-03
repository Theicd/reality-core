const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

const BITNET_SERVER = 'http://localhost:3021';
const BITNET_DIR = path.resolve(__dirname, '..', '..', '..', 'BitNet-i2_s');
const LLAMA_CLI = path.join(BITNET_DIR, 'bin', 'Release', 'llama-cli.exe');
const MODEL_PATH = path.join(BITNET_DIR, 'ggml-model-i2_s.gguf');

const PROMPTS = {
  earthquake: (data) => {
    const items = (data.items || []).slice(0, 5).map(e =>
      `- M${e.magnitude}, depth ${e.depth}km, "${e.place}", ${e.time}`).join('\n');
    return `You are the Chief Seismologist of REALITY CORE Mission Control.
Recent seismic events from USGS:
${items || 'No significant events.'}

Analyze: Are these events correlated? Any tsunami risk? Rate overall threat 1-5.
Return ONLY valid JSON: {"alert_level":N,"summary":"...","tsunami_risk":"low|medium|high","correlation":"yes|no|maybe"}`;
  },

  weather: (data) => {
    const items = (data.items || []).slice(0, 6).map(w =>
      `- ${w.city}: ${w.temperature}°C, wind ${w.windspeed}km/h`).join('\n');
    return `You are the Meteorological Officer at REALITY CORE Command.
Current global weather readings:
${items || 'No data.'}

Identify any extreme conditions. Summarize global weather status in one sentence.
Return ONLY valid JSON: {"alert_level":N,"summary":"...","extremes":[]}`;
  },

  space_weather: (data) => {
    return `You are the Space Weather Analyst at REALITY CORE Mission Control.
Current readings from NOAA SWPC:
- KP Index: ${data.kpIndex || 'N/A'}
- Solar Wind Speed: ${data.solarWindSpeed || 'N/A'} km/s
- Active alerts: ${(data.alerts || []).length}

Analyze impact on satellite communications and GPS systems. Rate geomagnetic threat 1-5.
Return ONLY valid JSON: {"alert_level":N,"summary":"...","affected_systems":[],"recommended_action":"..."}`;
  },

  aviation: (data) => {
    return `You are the Air Traffic Intelligence Officer at REALITY CORE.
Current tracking: ${data.count || 0} aircraft (${data.totalInApi || 0} total in airspace).

Any unusual density patterns? Rate aviation risk 1-5.
Return ONLY valid JSON: {"alert_level":N,"summary":"...","anomalies":[]}`;
  },

  marine: (data) => {
    const items = (data.items || []).slice(0, 5).map(b =>
      `- Station ${b.station}: waves ${b.waveHeight || '?'}m, water ${b.waterTemp || '?'}°C, wind ${b.windSpeed || '?'}m/s`).join('\n');
    return `You are the Maritime Safety Officer at REALITY CORE Command.
Buoy station readings:
${items || 'No data.'}

Assess maritime conditions. Any hazardous seas?
Return ONLY valid JSON: {"alert_level":N,"summary":"...","hazardous_zones":[]}`;
  },

  ships: (data) => {
    const items = (data.items || []).slice(0, 8).map(s =>
      `- ${s.name}: speed ${s.speed}kn, course ${s.course}°, pos ${s.geo?.lat?.toFixed(2)}°N ${s.geo?.lon?.toFixed(2)}°E`).join('\n');
    return `You are the Maritime Intelligence Officer at REALITY CORE Command.
AIS tracking data - ${data.count || 0} vessels in monitoring zone:
${items || 'No vessels.'}

Analyze vessel traffic patterns. Flag any suspicious behavior (unusual speed changes, course deviations, AIS signal gaps).
Return ONLY valid JSON: {"alert_level":N,"summary":"...","suspicious_activity":false,"vessels_of_interest":[],"recommendation":"..."}`;
  },

  iss: (data) => {
    return `You are the Space Station Monitor at REALITY CORE.
ISS current position: ${data.geo?.lat?.toFixed(2)}°N, ${data.geo?.lon?.toFixed(2)}°E
Altitude: ${data.altitude || 408} km, Velocity: ${data.velocity || 27600} km/h

Report ISS status. What region is it currently flying over?
Return ONLY valid JSON: {"alert_level":1,"summary":"...","region":"...","visibility":"..."}`;
  },

  solar_system: (data) => {
    const planets = (data.planets || []).map(p => `- ${p.name}: ${p.semiMajorAU} AU, angle ${p.posAngle?.toFixed(1)}°`).join('\n');
    const moon = data.moon;
    return `You are the Planetary Science Officer at REALITY CORE.
Current solar system positions:
${planets}
Moon: ${moon?.phaseName || '?'}, illumination ${moon?.illumination || '?'}%

Any notable planetary alignments or astronomical events?
Return ONLY valid JSON: {"alert_level":1,"summary":"...","alignments":[],"moon_phase":"${moon?.phaseName || ''}"}`;
  },

  radiation: (data) => {
    return `You are a Space Radiation Expert at REALITY CORE Mission Control.
Radiation readings from multiple detectors:
- CRaTER (Lunar orbit): flux ${data.crater_flux || 'N/A'} particles/cm²/s
- MSL/RAD (Mars surface): dose ${data.msl_dose || 'N/A'} mGy/day
- ISS: accumulated ${data.iss_dose || 'N/A'} mSv/hour

Analyze combined radiation environment. Is there a solar particle event in progress?
Rate risk to spacecraft and astronauts 1-5.
Return ONLY valid JSON: {"alert_level":N,"event_type":"solar_flare|cosmic_ray_burst|nominal","summary":"...","affected_zones":[],"recommendation":"..."}`;
  },

  ice_sheets: (data) => {
    return `You are a Senior Cryosphericist at REALITY CORE.
Glacier velocity data from Copernicus:
- Current velocity: ${data.velocity_current || 'N/A'} m/year
- Previous year: ${data.velocity_prev || 'N/A'} m/year
- Decade average: ${data.velocity_decade_avg || 'N/A'} m/year
- Ocean temperature anomaly: ${data.ocean_temp_anomaly || 'N/A'}°C

Is the acceleration rate anomalous? Assess sea level rise implications.
Return ONLY valid JSON: {"alert_level":N,"acceleration_significant":true,"sea_level_impact":"low|medium|high","confidence":0.0,"summary":"..."}`;
  },

  subsurface: (data) => {
    return `You are the Chief Geologist at REALITY CORE.
Subsurface data from British Geological Survey:
- Borehole depth: ${data.depth || 'N/A'} m, rock type: ${data.rock_type || 'N/A'}
- Local seismic events this week: ${data.seismic_count || 0}
- Groundwater level change: ${data.groundwater_change || 'N/A'} cm/day

Evaluate correlation between drilling activity, seismicity and groundwater.
Is this natural or potentially induced activity?
Return ONLY valid JSON: {"alert_level":N,"correlation_found":false,"risk_level":N,"analysis":"...","action":"..."}`;
  },

  waves_tides: (data) => {
    return `You are the Chief Maritime Forecaster at REALITY CORE.
Buoy station ${data.station || '?'} readings:
- Significant wave height: ${data.wave_height || '?'} m (change: ${data.wave_change || '?'} m/2hr)
- Max wave period: ${data.wave_period || '?'} s
- Barometric pressure: ${data.pressure || '?'} hPa (trend: ${data.pressure_trend || '?'} hPa/hr)
- Wind: ${data.wind_speed || '?'} knots, gusts ${data.wind_gust || '?'} knots

Assess storm severity and coastal flood risk.
Return ONLY valid JSON: {"alert_level":N,"storm_severity":N,"coastal_flood_risk":"low|medium|high","evacuation_recommended":false,"summary":"..."}`;
  },

  correlation: (allData) => {
    const parts = [];
    if (allData.earthquake) parts.push(`Earthquakes: ${allData.earthquake.count || 0} events, max M${Math.max(...(allData.earthquake.items||[]).map(e=>e.magnitude||0))}`);
    if (allData.weather) parts.push(`Weather stations: ${(allData.weather.items || []).length} reporting`);
    if (allData.space_weather) parts.push(`KP Index: ${allData.space_weather.kpIndex || 'N/A'}, Solar Wind: ${allData.space_weather.solarWindSpeed || 'N/A'} km/s`);
    if (allData.aviation) parts.push(`Aircraft tracked: ${allData.aviation.count || 0}`);
    if (allData.marine) parts.push(`Buoy stations: ${(allData.marine.items || []).length} active`);
    if (allData.ships) parts.push(`Ships tracked: ${allData.ships.count || 0}`);
    if (allData.iss) parts.push(`ISS: ${allData.iss.geo?.lat?.toFixed(1)}°N, ${allData.iss.geo?.lon?.toFixed(1)}°E`);
    return `You are the Chief Analyst of REALITY CORE, a global monitoring command center.
Current multi-domain status:
${parts.join('\n')}

Cross-reference ALL domains. Identify inter-domain correlations or cascading threats.
Consider: solar-seismic links, weather-maritime impacts, aviation disruptions from space weather.
Return ONLY valid JSON: {"threat_level":N,"conclusion":"...","correlations":[],"confidence":0.0-1.0}`;
  }
};

const ANALYSIS_PARAMS = {
  earthquake:    { temperature: 0.2, num_predict: 150, num_ctx: 2048 },
  weather:       { temperature: 0.3, num_predict: 150, num_ctx: 2048 },
  space_weather: { temperature: 0.2, num_predict: 150, num_ctx: 2048 },
  aviation:      { temperature: 0.3, num_predict: 100, num_ctx: 2048 },
  marine:        { temperature: 0.3, num_predict: 150, num_ctx: 2048 },
  ships:         { temperature: 0.4, num_predict: 150, num_ctx: 2048 },
  iss:           { temperature: 0.3, num_predict: 100, num_ctx: 2048 },
  solar_system:  { temperature: 0.3, num_predict: 150, num_ctx: 2048 },
  radiation:     { temperature: 0.35, num_predict: 150, num_ctx: 2048 },
  ice_sheets:    { temperature: 0.25, num_predict: 150, num_ctx: 2048 },
  subsurface:    { temperature: 0.4, num_predict: 150, num_ctx: 2048 },
  waves_tides:   { temperature: 0.2, num_predict: 150, num_ctx: 2048 },
  correlation:   { temperature: 0.5, num_predict: 250, num_ctx: 2048 }
};

class BitNetBridge {
  constructor() {
    this.available = false;
    this.mode = 'none'; // 'server' | 'direct' | 'none'
    this.lastAnalysis = {};
    this.analysisHistory = [];
    this.maxHistory = 50;
    this.busy = false;
  }

  async init() {
    // Try server mode first (BitNet server at port 3021)
    try {
      const res = await axios.get(`${BITNET_SERVER}/api/health`, { timeout: 3000 });
      if (res.data && res.data.ready) {
        this.available = true;
        this.mode = 'server';
        logger.info('BitNet Bridge: Connected to BitNet server (port 3021)');
        return true;
      }
    } catch (e) {}

    // Try direct mode (llama-cli.exe)
    if (fs.existsSync(LLAMA_CLI) && fs.existsSync(MODEL_PATH)) {
      this.available = true;
      this.mode = 'direct';
      logger.info('BitNet Bridge: Using direct llama-cli mode');
      return true;
    }

    logger.warn('BitNet Bridge: NOT AVAILABLE - falling back to rule-based analysis');
    this.available = false;
    this.mode = 'none';
    return false;
  }

  async analyze(type, data) {
    if (!this.available || this.busy) return null;
    const promptFn = PROMPTS[type];
    if (!promptFn) return null;

    const prompt = promptFn(data);
    const params = ANALYSIS_PARAMS[type] || ANALYSIS_PARAMS.weather;

    try {
      this.busy = true;
      let rawResponse;

      if (this.mode === 'server') {
        rawResponse = await this.callServer(prompt, params);
      } else {
        rawResponse = await this.callDirect(prompt, params);
      }

      const parsed = this.parseJSON(rawResponse);
      if (parsed) {
        parsed._type = type;
        parsed._timestamp = new Date().toISOString();
        parsed._raw = rawResponse;
        this.lastAnalysis[type] = parsed;
        this.analysisHistory.unshift(parsed);
        if (this.analysisHistory.length > this.maxHistory) this.analysisHistory.pop();
        logger.info(`BitNet analysis [${type}]: alert_level=${parsed.alert_level || parsed.threat_level || '?'}`);
      }
      return parsed;
    } catch (e) {
      logger.error(`BitNet analysis error [${type}]: ${e.message}`);
      return null;
    } finally {
      this.busy = false;
    }
  }

  async callServer(prompt, params) {
    const res = await axios.post(`${BITNET_SERVER}/api/generate`, {
      prompt,
      profile: 'custom',
      options: {
        temperature: params.temperature,
        num_predict: params.num_predict,
        num_ctx: params.num_ctx,
        num_thread: 4
      }
    }, { timeout: 60000 });
    return res.data.response || '';
  }

  callDirect(prompt, params) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', MODEL_PATH, '-p', prompt,
        '-n', String(params.num_predict),
        '-t', '4', '-c', String(params.num_ctx),
        '--temp', String(params.temperature),
        '--top-k', '40', '--top-p', '0.95',
        '--repeat-penalty', '1.1',
        '-r', 'User:', '-b', '64',
        '--no-warmup', '--no-display-prompt'
      ];
      const cwd = path.dirname(LLAMA_CLI);
      let output = '';
      const child = spawn(LLAMA_CLI, args, { cwd, timeout: 60000 });
      child.stdout.on('data', (c) => { output += c.toString(); });
      child.stderr.on('data', () => {});
      child.on('close', () => {
        output = output.replace(/\bAssistant\s*:/gi, '').replace(/\[\s*end of text\s*\]/gi, '').trim();
        resolve(output);
      });
      child.on('error', reject);
    });
  }

  parseJSON(text) {
    if (!text) return null;
    // Try to extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e) {}
    }
    // Try the whole text
    try { return JSON.parse(text); } catch (e) {}
    // Return as summary if no JSON
    return { summary: text.slice(0, 300), alert_level: 1, _parseError: true };
  }

  getStatus() {
    return {
      available: this.available,
      mode: this.mode,
      busy: this.busy,
      lastAnalysis: Object.keys(this.lastAnalysis),
      historyCount: this.analysisHistory.length
    };
  }

  getLastAnalysis(type) { return type ? this.lastAnalysis[type] : this.lastAnalysis; }
  getHistory(limit = 20) { return this.analysisHistory.slice(0, limit); }
}

module.exports = BitNetBridge;
