require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');
const License = require('../src/models/License');
const Client = require('../src/models/Client');
const Contact = require('../src/models/Contact');
const Product = require('../src/models/Product');
const Project = require('../src/models/Project');

async function seed() {
  await mongoose.connect(config.mongoUri);

  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const projectId = new mongoose.Types.ObjectId();
  const licenseId = new mongoose.Types.ObjectId();
  const key = 'ABC123';

  await Promise.all([
    Client.deleteOne({ userid: customerId }),
    Contact.deleteOne({ userid: customerId }),
    Product.deleteOne({ id: productId }),
    Project.deleteOne({ id: projectId }),
    License.deleteOne({ licenkey: key })
  ]);

  await Client.create({ _id: customerId, userid: customerId, company: 'Admin' });
  await Contact.create({ userid: customerId, email: 'admin@example.com', is_primary: 1 });
  await Product.create({ _id: productId, id: productId, name: 'License Pro' });
  await Project.create({ _id: projectId, id: projectId, name: 'Cabify Ecommerce' });
  await License.create({
    _id: licenseId,
    id: licenseId,
    name: 'Demo License',
    product_id: productId,
    project_id: projectId,
    licenkey: key,
    customer_id: customerId,
    expiry_date: '2027-11-05',
    status: 'active',
    remarks: 'Seed data',
    domain: 'cabify.ecommerce.com',
    domain_slug: 'cabify-ecommerce-technocratshorizons-com'
  });

  console.log(`Seeded license: ${key}`);
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close();
  process.exitCode = 1;
});
