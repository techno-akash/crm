const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  product_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  project_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  licenkey: { type: String, required: true, unique: true, index: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiry_date: { type: Date },
  status: String,
  remarks: String,
  domain: String,
  domain_slug: String
}, { collection: 'tbllicenses', versionKey: false, strict: true });

module.exports = mongoose.model('License', schema);
