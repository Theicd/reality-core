const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const config = require('../core/config');
const logger = require('../core/logger');
const { startAll, stopAll, getStatuses } = require('../core/connectors');
const AIEngine = require('../core/ai');
const { setupWebSocket } = require('./ws/wsServer');
const apiRoutes = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'ui')));

const ai = new AIEngine();
app.locals.ai = ai;
app.locals.getStatuses = getStatuses;

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'ui', 'index.html'));
});

const server = http.createServer(app);
const wss = setupWebSocket(server, ai);

async function boot() {
  try {
    logger.info('=== REALITY CORE BOOTING ===');
    ai.start();
    await startAll();
    server.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
      logger.info(`WebSocket on ws://localhost:${config.port}`);
    });
  } catch (err) {
    logger.error('Boot failed: ' + err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => { logger.info('Shutting down...'); stopAll(); ai.stop(); process.exit(0); });
boot();
