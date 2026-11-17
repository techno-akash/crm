const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const AuthSession = require('../models/AuthSession');
const { hash } = require('../services/auth.crypto');
const { ACCESS, modelFor } = require('../services/auth.service');
async function requireAuth(req, res, next) {
  let claims;
  const token = req.cookies?.[ACCESS];
  try {
    claims = jwt.verify(token || '', config().secret, { algorithms: ['HS256'], issuer: 'isolated-auth', audience: 'auth-session' });
    if (!['staff', 'customer'].includes(claims.type) || !/^[a-f\d]{24}$/i.test(claims.id || '') || !claims.jti || claims.purpose) throw new Error();
  } catch { return res.status(401).json({ message: 'Authentication required' }); }
  try {
    const [user, session] = await Promise.all([
      modelFor(claims.type).findOne({ _id: claims.id, isActive: true, sessionVersion: claims.version }),
      AuthSession.findOne({ tokenHash: hash(token), userId: claims.id, userType: claims.type, expiresAt: { $gt: new Date() } })
    ]);
    if (!user || !session || (claims.type === 'staff' && claims.role !== user.role)) return res.status(401).json({ message: 'Authentication required' });
    req.auth = { user, type: claims.type, claims };
    next();
  } catch (error) { next(error); }
}
function requireRole(role) {
  return (req, res, next) => {
    const valid = role === 'customer' ? req.auth?.type === 'customer'
      : req.auth?.type === 'staff' && (role === 'staff' || req.auth.user.role === role);
    if (!valid) return res.status(403).json({ message: 'Access denied' });
    return next();
  };
}
module.exports = { requireAuth, requireRole };
