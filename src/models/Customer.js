const mongoose = require('mongoose');
const fields = require('./auth.model-fields');
const schema = new mongoose.Schema({
  ...fields(),
  profile: { name: String, phone: String, company: String, address: String }
}, { collection: 'customers', timestamps: true });
module.exports = mongoose.model('AuthCustomer', schema);
