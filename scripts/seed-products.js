require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');

const products = [
  {
    id: 2,
    name: 'Cabinet Solution E-Commerce',
    description: 'Modules\n- Admin Panel\n- Customer Portal\n- Wholesaler Portal\n- Employer Portal\n- Custom Ordering',
    status: 'active',
    created_at: new Date('2025-04-11 13:03:41'),
    updated_at: new Date('2025-04-11 13:03:41')
  }
];

async function seedProducts() {
  await mongoose.connect(config.mongoUri);
  const collection = mongoose.connection.collection('tblproducts');

  let upserted = 0;
  for (const product of products) {
    const result = await collection.updateOne(
      { id: product.id },
      { $set: product },
      { upsert: true }
    );
    if (result.upsertedCount) upserted += 1;
  }

  const total = await collection.countDocuments({ id: { $type: 'number' } });
  console.log(`Products seed done: ${products.length} processed, ${upserted} inserted, total numeric-id products: ${total}`);
  await mongoose.connection.close();
}

seedProducts().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
