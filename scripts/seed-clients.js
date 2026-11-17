require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');

const NUMERIC_FIELDS = [
  'userid', 'country', 'active', 'leadid', 'default_currency',
  'show_primary_contact', 'registration_confirmed', 'addedfrom'
];

const CSV = `userid;company;vat;phonenumber;country;city;zip;state;address;website;datecreated;active;leadid;billing_street;billing_city;billing_state;billing_zip;billing_country;shipping_street;shipping_city;shipping_state;shipping_zip;shipping_country;longitude;latitude;default_language;default_currency;show_primary_contact;stripe_id;registration_confirmed;addedfrom
1;John;"";+1 (310) 927-4841;236;"";"";"";"";"";2024-12-30 18:37:26;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
2;Laurie Pinka;"";+1 (631) 335-7690;236;Bayport;11705;Washington;"";https://www.jamespinkafoundation.com/;2025-01-15 11:09:10;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
3;Faheem;"";+1 (281) 222-9491;236;Houston;77092;Taxes;"5805 Pinemont Drive, Suite B, Houston, TX-77092";"";2025-01-15 11:32:04;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
4;Kyle Fei;"";+1 (626) 715-3496;236;Irwindale;91706;California;"KNO TRADING INC 16252 ARROW HWY IRWINDALES, CA, 91706-2015 UNITED STATES OF AMERICA";"";2025-01-15 11:34:27;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
5;Gerald;"";+1 (509) 721-0227;236;Seattle;"";Washington;"";https://fasttrackcabinets.com/;2025-01-15 13:20:47;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
6;Ben Fennell;"";+1 (404) 860-1705;236;Seattle;98105;washington;"";https://tenantden.com/;2025-01-15 15:28:18;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
7;Indro;"";+61 422 157 426;14;Sydney;2170;New South Wales;"";https://thornado.com.au/;2025-01-15 15:38:29;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";3;"0";;1;1
8;Yaprak;"";+61 401 502 929;14;Sydney;"";New South Wales;"";https://hotspotmeet.com.au/;2025-01-15 15:46:24;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";3;"0";;1;1
9;Andrew;"";"";236;"";"";"";"";https://stackwizard.com/;2025-01-15 15:52:50;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
10;Andy Agarwal;"";+1 4083166540;236;San Diego;92126;California;"9393 Activity Rd ste d, San Diego, CA 92126, United States";https://weekendmaids.net/;2025-01-15 15:57:04;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
11;Bram Van Oost;"";"";22;Ghent;"";Flanders Region;"";https://sofaplanner.app/;2025-01-15 16:03:57;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
12;Laura Deutsch;"";631-334-5571;236;"";"";"";"";https://shineanddrive.com/;2025-01-15 16:11:54;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
13;Jason Tilton;"";(516) 922-8574;236;Oyster Bay;11771;New York;"1 Brookside Drive, Oyster Bay, New York, 11771, United States";https://www.tiltoncofferedceilings.com/;2025-01-15 16:20:00;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
14;Test;test;9999988888;"0";"";"";"";test;test.com;2025-03-07 12:21:32;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";1;"0";;1;1
15;Admin;"";"";"0";"";"";"";"";"";2025-04-04 15:01:12;1;;"";"";"";"";"0";"";"";"";"";"0";;;"";"0";"0";;1;1
16;Nippon Ply;"";9825037099;102;Ahmedabad;380015;Gujarat;"B-101, Westgate, Near YMCA Club, S.G. Highway, Ahmedabad, Gujarat, India - 380015.";https://nipponply.com/;2025-08-06 13:22:37;1;;"B-101, Westgate, Near YMCA Club, S.G. Highway, Ahmedabad, Gujarat, India - 380015.";Ahmedabad;Gujarat;380015;102;"B-101, Westgate, Near YMCA Club, S.G. Highway, Ahmedabad, Gujarat, India - 380015.";Ahmedabad;Gujarat;380015;102;;;english;4;"0";;1;1`;

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
      if (field === 'datecreated') {
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

async function seedClients() {
  await mongoose.connect(config.mongoUri);
  const collection = mongoose.connection.collection('tblclients');
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
  console.log(`Clients seed done: ${rows.length} processed, ${upserted} inserted, total numeric-userid clients: ${total}`);
  await mongoose.connection.close();
}

seedClients().catch(async (error) => {
  console.error(error.message);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
