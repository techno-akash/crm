const crypto = require('node:crypto');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const apiKey = process.env.API_KEY || process.env.STATIC_SECRET_KEY;
const nodeEnv = process.env.NODE_ENV || 'production';

if (!mongoUri) throw new Error('Missing required environment variable: MONGO_URI');
if (!apiKey) throw new Error('Missing required environment variable: API_KEY');

module.exports = {
  nodeEnv,
  port: Number.parseInt(process.env.PORT || '3000', 10),
  mongoUri,
  apiKey,
  rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  trustProxy: process.env.TRUST_PROXY === 'true',
  allowMissingDomain: (process.env.ALLOW_MISSING_DOMAIN || (nodeEnv === 'production' ? 'false' : 'true')) === 'true',
  timingSafeEqual(left, right) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
};
