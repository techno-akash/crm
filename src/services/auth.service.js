const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Customer = require('../models/Customer');
const AuthToken = require('../models/AuthToken');
const AuthSession = require('../models/AuthSession');
const AuthLog = require('../models/AuthLog');
const config = require('../config/auth');
const { hash } = require('./auth.crypto');
const DAY = 86400000;
const ACCESS = 'auth_access';
const REMEMBER = 'remember_token';
const modelFor = type => type === 'staff' ? Staff : Customer;
const cookieOptions = () => ({ httpOnly: true, secure: config().production, sameSite: 'strict', path: '/' });
const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
function publicUser(user, type) {
  return { id: String(user._id), email: user.email, type, ...(type === 'staff' ? { role: user.role } : { role: 'customer', profile: user.profile || {} }) };
}
async function audit(req, success, reason, user, type) {
  const inputEmail = user?.email || req.body?.email;
  const userType = type || req.body?.type;
  await AuthLog.create({ email: typeof inputEmail === 'string' ? inputEmail.trim().toLowerCase().slice(0, 254) : undefined, userType: ['staff', 'customer'].includes(userType) ? userType : undefined,
    userId: user?._id || null, success, reason, ip: req.ip, userAgent: (req.get('user-agent') || '').slice(0, 512) });
}
async function fail(user, type) {
  // Atomic pipeline: concurrent requests cannot lose increments or skip the threshold.
  return modelFor(type).findOneAndUpdate({ _id: user._id }, [
    { $set: { failedLoginCount: { $add: [{ $cond: [{ $and: [{ $ne: [{ $ifNull: ['$lockUntil', null] }, null] }, { $lte: ['$lockUntil', '$$NOW'] }] }, 0, { $ifNull: ['$failedLoginCount', 0] }] }, 1] } } },
    { $set: { lockUntil: { $cond: [{ $gte: ['$failedLoginCount', 10] }, { $add: ['$$NOW', 15 * 60000] }, '$lockUntil'] } } }
  ], { new: true });
}
function clearCookies(res) {
  res.clearCookie(ACCESS, cookieOptions());
  res.clearCookie(REMEMBER, cookieOptions());
}
async function revokeAll(userId, type) {
  await modelFor(type).updateOne({ _id: userId }, { $inc: { sessionVersion: 1 }, $unset: { twoFactorChallengeHash: 1, twoFactorCode: 1, twoFactorCodeExpiresAt: 1 } });
  await Promise.all([AuthToken.deleteMany({ userId, userType: type }), AuthSession.deleteMany({ userId, userType: type })]);
}
async function remember(req, res, user, type, expiry = new Date(Date.now() + 60 * DAY)) {
  const raw = crypto.randomBytes(32).toString('hex');
  await AuthToken.create({ userId: user._id, userType: type, tokenHash: hash(raw), sessionVersion: user.sessionVersion,
    userAgent: (req.get('user-agent') || '').slice(0, 512), lastIp: req.ip, expiresAt: expiry });
  res.cookie(REMEMBER, raw, { ...cookieOptions(), maxAge: expiry.getTime() - Date.now() });
}
async function issueSession(req, res, user, type, persistent, rotating = false) {
  const current = await modelFor(type).findOneAndUpdate({ _id: user._id, isActive: true, sessionVersion: user.sessionVersion,
    $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }] },
  { $set: { failedLoginCount: 0, lastLogin: new Date(), lastIp: req.ip }, $unset: { lockUntil: 1 } }, { new: true });
  if (!current) return res.status(401).json({ message: 'Authentication failed' });
  if (req.cookies[ACCESS]) await AuthSession.deleteOne({ tokenHash: hash(req.cookies[ACCESS]) });
  if (!rotating && req.cookies[REMEMBER]) await AuthToken.deleteOne({ tokenHash: hash(req.cookies[REMEMBER]) });
  if (!persistent) res.clearCookie(REMEMBER, cookieOptions());
  const token = jwt.sign({ id: String(current._id), type, ...(type === 'staff' ? { role: current.role } : { role: 'customer' }), version: current.sessionVersion },
    config().secret, { algorithm: 'HS256', expiresIn: '1d', issuer: 'isolated-auth', audience: 'auth-session', jwtid: crypto.randomUUID() });
  await AuthSession.create({ tokenHash: hash(token), userId: current._id, userType: type, expiresAt: new Date(Date.now() + DAY) });
  await audit(req, true, rotating ? 'session_refreshed' : 'login_success', current, type);
  if (persistent) await remember(req, res, current, type);
  res.cookie(ACCESS, token, { ...cookieOptions(), maxAge: DAY });
  return res.json({ user: publicUser(current, type) });
}
module.exports = { ACCESS, REMEMBER, modelFor, publicUser, audit, fail, clearCookies, revokeAll, issueSession, dummyHash };
