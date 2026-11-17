const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verify: verifyTotp } = require('otplib');
const Staff = require('../models/Staff');
const AuthToken = require('../models/AuthToken');
const AuthTokenUse = require('../models/AuthTokenUse');
const AuthSession = require('../models/AuthSession');
const config = require('../config/auth');
const { hash, hashCode, decrypt } = require('../services/auth.crypto');
const { sendMail } = require('../services/mailer');
const { ACCESS, REMEMBER, modelFor, publicUser, audit, fail, clearCookies, revokeAll, issueSession, dummyHash } = require('../services/auth.service');
const invalid = res => res.status(401).json({ message: 'Invalid email or password' });
const locked = user => user.lockUntil && user.lockUntil > new Date();
const login = type => async (req, res) => {
  const user = await modelFor(type).findOne({ email: req.body.email }).select('+password');
  if (!user) {
    await bcrypt.compare(req.body.password, dummyHash);
    await audit(req, false, 'invalid_credentials', null, type);
    return invalid(res);
  }
  if (locked(user)) {
    await audit(req, false, 'account_locked', user, type);
    return res.status(429).json({ message: 'Account temporarily locked. Try again later.' });
  }
  if (!await bcrypt.compare(req.body.password, user.password)) {
    await fail(user, type);
    await audit(req, false, 'invalid_credentials', user, type);
    return invalid(res);
  }
  if (!user.isActive) {
    await audit(req, false, 'account_inactive', user, type);
    return res.status(403).json({ message: 'Account is inactive. Contact administrator.' });
  }
  if (type === 'staff' && user.twoFactorEnabled) {
    const tempToken = jwt.sign({ id: String(user._id), purpose: '2fa' }, config().secret,
      { algorithm: 'HS256', expiresIn: '5m', issuer: 'isolated-auth', audience: 'auth-2fa', jwtid: crypto.randomUUID() });
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const updated = await Staff.updateOne({ _id: user._id, isActive: true, sessionVersion: user.sessionVersion }, { $set: {
      twoFactorChallengeHash: hash(tempToken), twoFactorRemember: req.body.rememberMe,
      twoFactorSessionVersion: user.sessionVersion,
      twoFactorCode: user.twoFactorMethod === 'email' ? hashCode(code) : null,
      twoFactorCodeExpiresAt: new Date(Date.now() + 3600000)
    } });
    if (!updated.matchedCount) return invalid(res);
    if (user.twoFactorMethod === 'email') sendMail(user.email, 'Your staff verification code', `Your verification code is ${code}. Code expires in one hour; the login challenge expires in five minutes. Start again if the challenge expires.`);
    await audit(req, true, 'two_factor_challenge', user, type);
    return res.json({ twoFactorRequired: true, tempToken });
  }
  return issueSession(req, res, user, type, req.body.rememberMe);
};
async function verify2fa(req, res) {
  let claims;
  try {
    claims = jwt.verify(req.body.tempToken, config().secret, { algorithms: ['HS256'], issuer: 'isolated-auth', audience: 'auth-2fa' });
    if (claims.purpose !== '2fa' || !/^[a-f\d]{24}$/i.test(claims.id || '')) throw new Error();
  } catch {
    await audit(req, false, 'invalid_2fa_challenge', null, 'staff');
    return res.status(401).json({ message: 'Invalid or expired verification code' });
  }
  const user = await Staff.findById(claims.id).select('+twoFactorSecret +twoFactorCode +twoFactorChallengeHash');
  const reject = async reason => {
    if (user) await fail(user, 'staff');
    await audit(req, false, reason, user, 'staff');
    return res.status(401).json({ message: 'Invalid or expired verification code' });
  };
  if (!user || !user.isActive || !user.twoFactorEnabled || locked(user) || user.twoFactorChallengeHash !== hash(req.body.tempToken)
    || !(user.twoFactorCodeExpiresAt > new Date()) || user.twoFactorSessionVersion !== user.sessionVersion) return reject('invalid_2fa');
  const query = { _id: user._id, isActive: true, sessionVersion: user.sessionVersion, twoFactorChallengeHash: hash(req.body.tempToken),
    twoFactorCodeExpiresAt: { $gt: new Date() }, $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }] };
  const set = {};
  if (user.twoFactorMethod === 'totp') {
    let result;
    try { result = await verifyTotp({ token: req.body.code, secret: decrypt(user.twoFactorSecret), epochTolerance: 30, ...(user.lastTotpStep != null ? { afterTimeStep: user.lastTotpStep } : {}) }); } catch { return reject('invalid_totp_configuration'); }
    if (!result.valid) return reject('invalid_2fa');
    const step = result.timeStep;
    query.$and = [{ $or: [{ lastTotpStep: null }, { lastTotpStep: { $lt: step } }] }];
    set.lastTotpStep = step;
  } else {
    query.twoFactorCode = hashCode(req.body.code);
  }
  const consumed = await Staff.findOneAndUpdate(query, { ...(Object.keys(set).length ? { $set: set } : {}),
    $unset: { twoFactorChallengeHash: 1, twoFactorCode: 1, twoFactorCodeExpiresAt: 1, twoFactorRemember: 1, twoFactorSessionVersion: 1 } });
  if (!consumed) return reject('invalid_or_replayed_2fa');
  return issueSession(req, res, consumed, 'staff', consumed.twoFactorRemember);
}
async function refresh(req, res) {
  const raw = req.cookies[REMEMBER];
  if (!/^[a-f\d]{64}$/i.test(raw || '')) return res.status(401).json({ message: 'Authentication required' });
  const tokenHash = hash(raw);
  let token = await AuthToken.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  const used = await AuthTokenUse.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  async function reuse(record) {
    await revokeAll(record.userId, record.userType);
    const user = await modelFor(record.userType).findById(record.userId);
    await audit(req, false, 'remember_token_reuse', user, record.userType);
    clearCookies(res);
    return res.status(401).json({ message: 'Authentication required. Please sign in again.' });
  }
  if (used) return reuse(used);
  if (!token) { clearCookies(res); return res.status(401).json({ message: 'Authentication required' }); }
  try {
    await AuthTokenUse.create({ tokenHash, userId: token.userId, userType: token.userType, expiresAt: token.expiresAt });
  } catch (error) { if (error.code === 11000) return reuse(token); throw error; }
  token = await AuthToken.findOneAndDelete({ _id: token._id });
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  const user = await modelFor(token.userType).findOne({ _id: token.userId, isActive: true, sessionVersion: token.sessionVersion });
  if (!user || locked(user)) {
    await audit(req, false, 'refresh_rejected', user, token.userType);
    clearCookies(res);
    return res.status(401).json({ message: 'Authentication required' });
  }
  return issueSession(req, res, user, token.userType, true, true);
}
async function forgot(req, res) {
  const { email, type } = req.body;
  const user = await modelFor(type).findOne({ email });
  if (user?.isActive) {
    const token = crypto.randomBytes(32).toString('hex');
    await modelFor(type).updateOne({ _id: user._id, isActive: true }, { $set: { resetPasswordToken: hash(token), resetPasswordExpires: new Date(Date.now() + 3600000) } });
    const url = new URL('/reset-password', config().frontend);
    url.search = new URLSearchParams({ type, userId: String(user._id), token }).toString();
    sendMail(user.email, 'Reset your password', `Reset your password within one hour: ${url.toString()}`);
  }
  await audit(req, true, 'password_reset_requested', user, type);
  return res.json({ message: 'If the email exists, a reset link has been sent' });
}
async function reset(req, res) {
  const { type, userId, token, password } = req.body;
  const query = { _id: userId, isActive: true, resetPasswordToken: hash(token), resetPasswordExpires: { $gt: new Date() } };
  const candidate = await modelFor(type).findOne(query);
  if (!candidate) {
    await audit(req, false, 'password_reset_invalid', null, type);
    return res.status(400).json({ message: 'Invalid or expired reset link' });
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  // Consume and revoke session version in the same atomic write.
  const user = await modelFor(type).findOneAndUpdate(query, { $set: { password: hashedPassword, failedLoginCount: 0 },
    $inc: { sessionVersion: 1 }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1, lockUntil: 1, twoFactorCode: 1, twoFactorChallengeHash: 1, twoFactorCodeExpiresAt: 1 } }, { new: true });
  if (!user) {
    await audit(req, false, 'password_reset_replayed', null, type);
    return res.status(400).json({ message: 'Invalid or expired reset link' });
  }
  await Promise.all([AuthToken.deleteMany({ userId, userType: type }), AuthSession.deleteMany({ userId, userType: type })]);
  await audit(req, true, 'password_reset_completed', user, type);
  sendMail(user.email, 'Your password was changed', 'Your password has been changed. Contact your administrator immediately if you did not request this.');
  clearCookies(res);
  return res.json({ message: 'Password reset. Please sign in.' });
}
async function logout(req, res) {
  let actor;
  if (req.cookies[ACCESS]) actor = await AuthSession.findOneAndDelete({ tokenHash: hash(req.cookies[ACCESS]) });
  if (req.cookies[REMEMBER]) {
    const remembered = await AuthToken.findOneAndDelete({ tokenHash: hash(req.cookies[REMEMBER]) });
    actor ||= remembered;
  }
  const user = actor ? await modelFor(actor.userType).findById(actor.userId) : null;
  await audit(req, true, 'logout', user, actor?.userType);
  clearCookies(res);
  return res.json({ message: 'Signed out' });
}
const me = (req, res) => res.json({ user: publicUser(req.auth.user, req.auth.type) });
module.exports = { login, verify2fa, refresh, forgot, reset, logout, me };
