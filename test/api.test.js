process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.API_KEY = 'existing-api-key';
process.env.RATE_LIMIT_MAX = '1000';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/server');
const License = require('../src/models/License');

const endpoint = '/api/license_validate/get_license_details?key=ABC123';

function mockAggregate(value) {
  License.aggregate = () => Promise.resolve(value);
}

test('rejects missing and invalid authorization before lookup', async (t) => {
  let called = false;
  License.aggregate = async () => { called = true; return []; };
  await t.test('missing', async () => {
    const response = await request(app).get(endpoint);
    assert.deepEqual(response.body, { status: 'unauthorized', error: 'API key missing' });
    assert.equal(response.status, 401);
  });
  await t.test('invalid', async () => {
    const response = await request(app).get(endpoint).set('Authorization', 'Bearer wrong');
    assert.deepEqual(response.body, { status: 'unauthorized', error: 'Invalid API key' });
    assert.equal(response.status, 401);
  });
  await t.test('invalid raw key', async () => {
    const response = await request(app).get(endpoint).set('Authorization', 'wrong');
    assert.deepEqual(response.body, { status: 'unauthorized', error: 'Invalid API key' });
    assert.equal(response.status, 401);
  });
  assert.equal(called, false);
});

test('validates the license key format', async () => {
  const response = await request(app)
    .get('/api/license_validate/get_license_details?key=ABC-123')
    .set('Authorization', 'Bearer existing-api-key');
  assert.deepEqual(response.body, { status: 'invalid', error: 'Invalid license key format' });
  assert.equal(response.status, 400);
});

test('returns not found when aggregation is empty', async () => {
  mockAggregate([]);
  const response = await request(app).get(endpoint).set('Authorization', 'Bearer existing-api-key');
  assert.deepEqual(response.body, { status: 'invalid', error: 'License not found' });
  assert.equal(response.status, 404);
});

test('accepts a raw API key and returns the exact successful response shape', async () => {
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'cabify.ecommerce.com',
    domain_slug: 'cabify-ecommerce-technocratshorizons-com',
    customer: { company: 'Admin' },
    primaryContact: { email: 'admin@example.com' }
  }]);
  const response = await request(app).get(endpoint).set('Authorization', 'existing-api-key');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    key: 'ABC123', expiry_date: '2027-11-05', user_name: 'Admin', user_email: 'admin@example.com',
    status: 'valid', site_url: 'cabify.ecommerce.com', domain_slug: 'cabify-ecommerce-technocratshorizons-com',
    payment_status: 'active', expiry_status: 'active'
  });
});

test('returns expired status using date-only comparison', async () => {
  mockAggregate([{ licenkey: 'ABC123', expiry_date: '2000-01-01' }]);
  const response = await request(app).get(endpoint).set('Authorization', 'Bearer existing-api-key');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'expired');
  assert.equal(response.body.expiry_status, 'expired');
});

test('accepts the request when origin matches the licensed domain', async () => {
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'https://cabify.ecommerce.com',
    status: 'active'
  }]);
  const response = await request(app)
    .get(endpoint)
    .set('Authorization', 'Bearer existing-api-key')
    .set('Origin', 'https://cabify.ecommerce.com');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'valid');
});

test('accepts www variants of the licensed domain', async () => {
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'https://cabify.ecommerce.com',
    status: 'active'
  }]);
  const response = await request(app)
    .get(endpoint)
    .set('Authorization', 'Bearer existing-api-key')
    .set('Origin', 'https://www.cabify.ecommerce.com/cart');
  assert.equal(response.status, 200);
});

test('accepts the referer header when origin is missing', async () => {
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'https://cabify.ecommerce.com',
    status: 'active'
  }]);
  const response = await request(app)
    .get(endpoint)
    .set('Authorization', 'Bearer existing-api-key')
    .set('Referer', 'https://cabify.ecommerce.com/checkout?page=2');
  assert.equal(response.status, 200);
});

test('rejects requests from a domain other than the licensed one', async () => {
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'https://cabify.ecommerce.com',
    status: 'active'
  }]);
  const response = await request(app)
    .get(endpoint)
    .set('Authorization', 'Bearer existing-api-key')
    .set('Origin', 'https://pirate-site.com');
  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { status: 'invalid', error: 'License not valid for this domain' });
});

test('rejects suspended licenses regardless of the domain', async () => {
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'https://cabify.ecommerce.com',
    status: 'suspended'
  }]);
  const response = await request(app)
    .get(endpoint)
    .set('Authorization', 'Bearer existing-api-key')
    .set('Origin', 'https://cabify.ecommerce.com');
  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { status: 'invalid', error: 'License is suspended' });
});

test('rejects missing domain headers when ALLOW_MISSING_DOMAIN is false', async (t) => {
  const configPath = '../src/config';
  const controllerPath = '../src/controllers/licenseController';
  const original = process.env.ALLOW_MISSING_DOMAIN;
  process.env.ALLOW_MISSING_DOMAIN = 'false';
  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(controllerPath)];
  t.after(() => {
    process.env.ALLOW_MISSING_DOMAIN = original;
    delete require.cache[require.resolve(configPath)];
    delete require.cache[require.resolve(controllerPath)];
  });

  const { getLicenseDetails } = require(controllerPath);
  mockAggregate([{
    licenkey: 'ABC123',
    expiry_date: '2027-11-05',
    domain: 'https://cabify.ecommerce.com',
    status: 'active'
  }]);
  const req = { query: { key: 'ABC123' }, get: () => undefined };
  const res = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; }
  };
  await getLicenseDetails(req, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { status: 'invalid', error: 'License not valid for this domain' });
});
