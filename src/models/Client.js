const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userid: { type: mongoose.Schema.Types.ObjectId, required: true },
  company: String
}, { collection: 'tblclients', versionKey: false, strict: true });

module.exports = mongoose.model('Client', schema);
