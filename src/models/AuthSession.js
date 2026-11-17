const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['staff', 'customer'], required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { collection: 'auth_sessions' });
schema.index({ userId: 1, userType: 1 });
module.exports = mongoose.model('AuthSession', schema);
