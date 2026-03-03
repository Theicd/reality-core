const EventEmitter = require('events');
const logger = require('../logger');
const { v4: uuidv4 } = require('uuid');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.history = [];
    this.maxHistory = 1000;
  }

  publish(type, data, source) {
    const event = {
      id: uuidv4(),
      type,
      source,
      timestamp: new Date().toISOString(),
      data,
      severity: data.severity || 0,
      geo: data.geo || null
    };
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();
    logger.debug(`Event published: ${type} from ${source}`);
    this.emit(type, event);
    this.emit('*', event);
    return event;
  }

  getHistory(type, limit = 50) {
    const filtered = type ? this.history.filter(e => e.type === type) : this.history;
    return filtered.slice(-limit);
  }

  getLatest(type) {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === type) return this.history[i];
    }
    return null;
  }
}

module.exports = new EventBus();
