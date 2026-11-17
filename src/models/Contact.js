const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userid: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  email: String,
  is_primary: { type: mongoose.Schema.Types.Mixed }
}, { collection: 'tblcontacts', versionKey: false, strict: true });

module.exports = mongoose.model('Contact', schema);
