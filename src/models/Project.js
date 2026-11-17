const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String
}, { collection: 'tblprojects', versionKey: false, strict: true });

module.exports = mongoose.model('Project', schema);
