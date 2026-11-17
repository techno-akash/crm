require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');

const NUMERIC_FIELDS = [
  'id', 'status', 'clientid', 'billing_type', 'progress', 'progress_from_tasks',
  'project_cost', 'project_rate_per_hour', 'estimated_hours', 'addedfrom', 'contact_notification'
];

const DATE_FIELDS = ['start_date', 'deadline', 'project_created', 'date_finished'];

const CSV = `id;name;description;status;clientid;billing_type;start_date;deadline;project_created;date_finished;progress;progress_from_tasks;project_cost;project_rate_per_hour;estimated_hours;addedfrom;contact_notification;notify_contacts;domain;domain_slug
1;CabinetAll;"";2;1;1;2024-12-30;;2024-12-30;;"0";1;;"0.00";;1;1;a:0:{};;
2;James Pinka Foundation;"";2;2;1;2025-01-15;;2025-01-15;;"0";1;"4500.00";"0.00";;1;1;a:0:{};;
3;FastTrack Cabinets;"";4;5;1;2024-11-29;;2025-01-15;;"0";1;"500.00";"0.00";;1;1;a:0:{};;
4;Renovvo Cabinets;"";2;3;1;2024-11-27;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
5;Tenantden;"";2;6;1;2024-12-13;2025-02-05;2025-01-15;;"0";1;"3126.00";"0.00";"250.00";1;1;a:0:{};;
6;Thornado;"";4;7;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
7;Hotspot Meet;"";4;8;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
8;Stack Wizard;"";4;9;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
9;Homeco;"";4;4;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
10;Weekend Maids;"";4;10;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
11;Sofa Planner;"";4;11;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
12;Shine N Drive;"";4;12;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
13;Tilton Coffered Ceilings;"";4;13;1;2025-01-15;;2025-01-15;;"0";1;;"0.00";;1;1;a:0:{};;
14;Test Project;<p>Test Description</p>;2;15;1;2025-04-04;2025-04-04;2025-04-04;;"0";1;;"0.00";;1;1;a:0:{};https://test.com;https-test-com`;

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
      } else if (NUMERIC_FIELDS.includes(field) && /^\d+(\.\d+)?$/.test(value)) {
        doc[field] = Number(value);
      } else {
        doc[field] = value;
      }
    });
    return doc;
  });
}

async function seedProjects() {
  await mongoose.connect(config.mongoUri);
  const collection = mongoose.connection.collection('tblprojects');
  const rows = parseRows(CSV);

  let upserted = 0;
  for (const row of rows) {
    const result = await collection.updateOne(
      { id: row.id },
      { $set: row },
      { upsert: true }
    );
    if (result.upsertedCount) upserted += 1;
  }

  const total = await collection.countDocuments({ id: { $type: 'number' } });
  console.log(`Projects seed done: ${rows.length} processed, ${upserted} inserted, total numeric-id projects: ${total}`);
  await mongoose.connection.close();
}

seedProjects().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
