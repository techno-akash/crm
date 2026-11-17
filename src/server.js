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

function redactLicenseKey(url) {
  return url.replace(/([?&]key=)[^&]*/i, '$1[Redacted]');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
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

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api/license_validate', licenseRoutes);
app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

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
