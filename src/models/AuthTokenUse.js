const mongoose = require('mongoose');
// Retain consumed hashes until original expiry so reuse remains detectable after rotation.
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['staff', 'customer'], required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { collection: 'auth_token_uses' });
module.exports = mongoose.model('AuthTokenUse', schema);
