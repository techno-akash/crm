require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');

const NUMERIC_FIELDS = [
  'id', 'userid', 'is_primary', 'active', 'invoice_emails', 'estimate_emails',
  'credit_note_emails', 'contract_emails', 'task_emails', 'project_emails', 'ticket_emails'
];

const DATE_FIELDS = ['datecreated', 'email_verified_at', 'email_verification_sent_at', 'last_login', 'last_password_change'];

const CSV = `id;userid;is_primary;firstname;lastname;email;phonenumber;title;datecreated;password;new_pass_key;new_pass_key_requested;email_verified_at;email_verification_key;email_verification_sent_at;last_ip;last_login;last_password_change;active;profile_image;direction;invoice_emails;estimate_emails;credit_note_emails;contract_emails;task_emails;project_emails;ticket_emails
1;14;1;test;test;test@yopmai.com;"";test;2025-03-07 12:21:53;$2a$08$0oL.bpxqIRF.AoEpXTipBOy9zm3jeEBGjJ7g8TCxgQ00Gd.eOsdlS;;;2025-03-07 12:21:53;;;162.158.23.159;2025-03-07 12:23:09;;1;;"";1;1;1;1;1;1;1
2;16;1;Mr Ketan;.;info@nipponply.com;+919825037099;"";2025-08-06 13:23:55;$2a$08$JVW7c5G1AsDMyuZLJ6aeYes.7I8.Hy7ToZ13c0EYUbRD8yrbCgK7G;;;2025-08-06 13:23:55;;;;;;1;;"";1;1;1;1;1;1;1`;

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
      if (DATE_FIELDS.includes(field) && value) {
        doc[field] = new Date(value);
      } else if (NUMERIC_FIELDS.includes(field) && /^\d+$/.test(value)) {
        doc[field] = Number(value);
      } else {
        doc[field] = value;
      }
    });
    return doc;
  });
}

async function seedContacts() {
  await mongoose.connect(config.mongoUri);
  const collection = mongoose.connection.collection('tblcontacts');
  const rows = parseRows(CSV);

  let upserted = 0;
  for (const row of rows) {
    const result = await collection.updateOne(
      { userid: row.userid },
      { $set: row },
      { upsert: true }
    );
    if (result.upsertedCount) upserted += 1;
  }

  const total = await collection.countDocuments({ userid: { $type: 'number' } });
  console.log(`Contacts seed done: ${rows.length} processed, ${upserted} inserted, total numeric-userid contacts: ${total}`);
  await mongoose.connection.close();
}

seedContacts().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
