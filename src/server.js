const path = require('node:path');
const fs = require('node:fs');

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const config = require('./config');
const connectDb = require('./config/db');
const logger = require('./utils/logger');
const licenseRoutes = require('./routes/licenseRoutes');
const adminLicenseRoutes = require('./routes/adminLicenseRoutes');

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function cors(req, res, next) {
  const origin = req.get('origin');
  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

function redactLicenseKey(url) {
  return url.replace(/([?&]key=)[^&]*/i, '$1[Redacted]');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(mongoSanitize());
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: redactLicenseKey(req.url),
        headers: req.headers,
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      };
    }
  }
}));
app.use(rateLimit({ windowMs: config.rateLimitWindowMs, limit: config.rateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false }));

app.use(cors);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api/license_validate', licenseRoutes);
app.use('/api/licenses', adminLicenseRoutes);

const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
if (config.nodeEnv === 'production' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api|\/health).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const expose = config.nodeEnv !== 'production';
  logger.error({ err: { message: error.message, stack: expose ? error.stack : undefined, status } }, 'Unhandled request error');
  if (res.headersSent) return;
  res.status(status).json({
    status: 'error',
    message: status < 500 || expose ? error.message : 'Internal server error'
  });
});

async function start() {
  await connectDb(config.mongoUri);
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port);
    server.once('error', reject);
    server.once('listening', () => {
      logger.info({ port: config.port }, 'License API started');
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    logger.error({ err: error }, 'Unable to start server');
    process.exit(1);
  });
}

module.exports = { app, start };
