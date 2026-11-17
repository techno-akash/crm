const mongoose = require('mongoose');
module.exports = () => ({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  isActive: { type: Boolean, default: true },
  failedLoginCount: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastIp: String,
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: Date,
  sessionVersion: { type: Number, default: 0 },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
});
