const mongoose = require('mongoose');
const fields = require('./auth.model-fields');
const schema = new mongoose.Schema({
  ...fields(),
  role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: { type: String, enum: ['email', 'totp'], default: 'email' },
  twoFactorSecret: { type: String, select: false },
  twoFactorCode: { type: String, select: false },
  twoFactorCodeExpiresAt: Date,
  twoFactorChallengeHash: { type: String, select: false },
  twoFactorRemember: Boolean,
  twoFactorSessionVersion: Number,
  lastTotpStep: Number
}, { collection: 'staff', timestamps: true });
module.exports = mongoose.model('AuthStaff', schema);
