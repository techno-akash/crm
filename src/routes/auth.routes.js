const express = require('express');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('../config/auth');
const { validate } = require('../validators/auth.validators');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { audit } = require('../services/auth.service');
const controller = require('../controllers/auth.controller');
const router = express.Router();
let indexesReady;
async function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = Promise.all(['Staff', 'Customer', 'AuthToken', 'AuthTokenUse', 'AuthSession', 'AuthLog'].map(name => require(`../models/${name}`).init()))
      .catch(error => { indexesReady = undefined; throw error; });
  }
  return indexesReady;
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Mounted ahead of legacy CORS and request logging so auth credentials never enter legacy logs.
router.use(['/api/admin/auth', '/api/auth', '/api/licenses'], wrap(async (req, res, next) => {
  let settings;
  try { settings = config(); } catch { return res.status(503).json({ message: 'Authentication service is not configured' }); }
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  if (settings.production && !req.secure) return res.status(426).json({ message: 'HTTPS is required' });
  const origin = req.get('origin');
  if ((origin && !settings.origins.has(origin)) || req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ message: 'Origin is not allowed' });
  }
  // JSON-only mutations + strict origin checking protect against CSRF, including login CSRF.
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ message: 'Content-Type must be application/json' });
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Authentication service unavailable' });
  await ensureIndexes();
  next();
}), express.json({ limit: '10kb' }), cookieParser(), mongoSanitize());
function limit(max, reason) {
  return rateLimit({ windowMs: 60000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: wrap(async (req, res) => {
      // Do not let arbitrary invalid request data become an audit document.
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : undefined;
      const type = req.originalUrl.startsWith('/api/admin/') ? 'staff' : req.body?.type === 'staff' ? 'staff' : 'customer';
      await audit({ ...req, body: { email }, ip: req.ip, get: name => req.get(name) }, false, reason, null, type);
      res.status(429).json({ message: 'Too many attempts. Try again in a minute.' });
    })
  });
}
const loginLimit = limit(5, 'login_rate_limited');
const verifyLimit = limit(5, 'two_factor_rate_limited');
const forgotLimit = limit(3, 'reset_rate_limited');
const refreshLimit = limit(10, 'refresh_rate_limited');
const licenseConfig = require('../config');
router.use('/api/licenses', rateLimit({ windowMs: licenseConfig.rateLimitWindowMs, limit: licenseConfig.rateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false }), require('./adminLicenseRoutes'));
router.post('/api/admin/auth/login', loginLimit, validate('login'), wrap(controller.login('staff')));
router.post('/api/auth/customer/login', loginLimit, validate('login'), wrap(controller.login('customer')));
router.post('/api/admin/auth/verify-2fa', verifyLimit, validate('verify'), wrap(controller.verify2fa));
router.post('/api/auth/forgot-password', forgotLimit, validate('forgot'), wrap(controller.forgot));
router.post('/api/auth/reset-password', forgotLimit, validate('reset'), wrap(controller.reset));
router.get('/api/auth/refresh', refreshLimit, validate('empty', 'query'), wrap(controller.refresh));
router.post('/api/auth/logout', validate('empty'), wrap(controller.logout));
router.get('/api/auth/me', validate('empty', 'query'), requireAuth, controller.me);
router.get('/api/admin/auth/dashboard', validate('empty', 'query'), requireAuth, requireRole('staff'), controller.me);
router.get('/api/admin/auth/admin-only', validate('empty', 'query'), requireAuth, requireRole('admin'), controller.me);
router.get('/api/auth/customer/portal', validate('empty', 'query'), requireAuth, requireRole('customer'), controller.me);
router.use(['/api/admin/auth', '/api/auth', '/api/licenses'], (req, res) => res.status(404).json({ message: 'Authentication route not found' }));
// This handler is deliberately scoped to this router: legacy error responses stay intact.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON request' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large' });
  require('../utils/logger').error('Authentication request failed');
  if (req.originalUrl.startsWith('/api/licenses')) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({ status: 'error', message: status < 500 ? error.message : 'Internal server error' });
  }
  return res.status(503).json({ message: 'Authentication service unavailable. Please try again.' });
});
module.exports = router;
