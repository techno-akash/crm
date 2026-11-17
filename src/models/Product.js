const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String
}, { collection: 'tblproducts', versionKey: false, strict: true });

module.exports = mongoose.model('Product', schema);
