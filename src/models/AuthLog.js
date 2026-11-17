const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true },
  userType: { type: String, enum: ['staff', 'customer'] },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  success: { type: Boolean, required: true },
  reason: { type: String, required: true },
  ip: String, userAgent: String,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'auth_logs' });
schema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('AuthLog', schema);
