const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, required: true, unique: true },
  userType: { type: String, enum: ['staff', 'customer'], required: true },
  userAgent: String, lastIp: String,
  sessionVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'auth_tokens' });
schema.index({ userId: 1, userType: 1 });
module.exports = mongoose.model('AuthToken', schema);
