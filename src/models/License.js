const mongoose = require('mongoose');

const { Schema } = mongoose;

// `id`, `product_id`, `project_id` and `customer_id` intentionally use Mixed so the
// collection can hold both legacy numeric ids and ObjectId references.
const schema = new Schema({
  id: { type: Schema.Types.Mixed },
  name: String,
  product_id: { type: Schema.Types.Mixed, required: true },
  project_id: { type: Schema.Types.Mixed, required: true },
  licenkey: { type: String, required: true, unique: true, index: true },
  customer_id: { type: Schema.Types.Mixed, required: true },
  expiry_date: { type: Date },
  status: String,
  remarks: String,
  environment: String,
  domain: String,
  domain_slug: String
}, { collection: 'tbllicenses', versionKey: false, strict: true });

module.exports = mongoose.model('License', schema);
