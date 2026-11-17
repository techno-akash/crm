require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');

const NUMERIC_FIELDS = ['id', 'product_id', 'project_id', 'customer_id'];

const DATE_FIELDS = ['expiry_date', 'created_at', 'updated_at'];

const CSV = `id;name;product_id;domain;domain_slug;project_id;licenkey;customer_id;expiry_date;status;environment;remarks;created_at;updated_at
2;John| Cabinetall;2;https://cabinetlyusa.com;cabinetlyusa-com;1;8064A51BCBB15605;1;2047-04-30;active;production;;2025-04-11 13:05:09;2026-04-13 21:06:22
3;License For Cabinetall;2;https://cabinetall.technocratshorizons.com;cabinetall-technocratshorizons-com;14;94ECAC379D207671;15;2027-12-21;active;staging;;2025-04-17 12:43:56;2026-11-05 15:19:22
4;Cabify;2;https://cabify-staging.technohorizons.com;cabify-staging-technohorizons-com;14;D38CEA78B88CB054;15;2036-05-31;active;staging;;2025-05-12 13:22:24;2026-04-13 21:04:37
5;Renovvo Cabinets;2;https://renovvocabinets.com;renovvocabinets-com;4;63D070F30DCFD721;3;2036-10-31;active;production;;2025-10-07 12:26:53;2026-04-13 21:04:26
6;cabify-customer-demo.technohorizons.com;2;https://cabify-customer-demo.technohorizons.com;cabify-customer-demo-technohorizons-com;14;E89109B0B875F963;15;2027-05-19;active;staging;;2026-04-20 16:28:17;2026-11-05 15:19:42
7;cabify-ecommerce.technocratshorizons.com;2;https://cabify-ecommerce.technocratshorizons.com;cabify-ecommerce-technocratshorizons-com;14;A35F24CDBD921BFE;15;2027-11-05;active;staging;;2026-11-05 18:04:02;2026-11-05 23:34:02`;

function unquote(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function parseRows(csv) {
  const [headerLine, ...lines] = csv.trim().split('\n');
  const fields = headerLine.split(';');
  return lines.map((line) => {
    const raw = line.split(';');
    if (raw.length !== fields.length) {
      throw new Error(`Column mismatch: expected ${fields.length}, got ${raw.length} in "${line}"`);
    }
    const doc = {};
    fields.forEach((field, i) => {
      const value = unquote(raw[i]);
      if (DATE_FIELDS.includes(field)) {
        doc[field] = value ? new Date(value) : null;
      } else if (NUMERIC_FIELDS.includes(field) && /^\d+$/.test(value)) {
        doc[field] = Number(value);
      } else {
        doc[field] = value;
      }
    });
    return doc;
  });
}

async function seedLicenses() {
  await mongoose.connect(config.mongoUri);
  const collection = mongoose.connection.collection('tbllicenses');
  const rows = parseRows(CSV);

  let upserted = 0;
  for (const row of rows) {
    if (!row.licenkey) throw new Error(`Missing licenkey in row id ${row.id}`);
    const result = await collection.updateOne(
      { licenkey: row.licenkey },
      { $set: row },
      { upsert: true }
    );
    if (result.upsertedCount) upserted += 1;
  }

  const total = await collection.countDocuments({ licenkey: /^[A-Z0-9]{16}$/ });
  console.log(`Licenses seed done: ${rows.length} processed, ${upserted} inserted, total 16-char numeric keys: ${total}`);
  await mongoose.connection.close();
}

seedLicenses().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
