process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/unused';
process.env.API_KEY = 'existing-api-key';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-random-bytes';
process.env.AUTH_2FA_ENCRYPTION_KEY = '42'.repeat(32);
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { generate: generateTotp, generateSecret } = require('otplib');
const { hash, encrypt, decrypt } = require('../src/services/auth.crypto');
const mailer = require('../src/services/mailer');
const mails = [];
mailer.sendMail = (to, subject, text) => mails.push({ to, subject, text });
const { app } = require('../src/server');
const Staff = require('../src/models/Staff');
const Customer = require('../src/models/Customer');
const Token = require('../src/models/AuthToken');
const Session = require('../src/models/AuthSession');
const Log = require('../src/models/AuthLog');
const TokenUse = require('../src/models/AuthTokenUse');
const password = 'StrongPass123';
let ip = 0;
app.set('trust proxy', 'loopback');
const req = (method, url, fixedIp) => request(app)[method](url).set('X-Forwarded-For', fixedIp || `10.0.${Math.floor(++ip / 250)}.${ip % 250 + 1}`);
const cookies = res => (res.headers['set-cookie'] || []).filter(v => !v.includes('Expires=Thu, 01 Jan 1970')).map(v => v.split(';')[0]);
const cookie = (res, name) => cookies(res).find(v => v.startsWith(`${name}=`));
const login = (type, email, rememberMe = false) => req('post', type === 'staff' ? '/api/admin/auth/login' : '/api/auth/customer/login').send({ email, password, rememberMe });
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
test('isolated authentication integration (real disposable MongoDB)', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-auth-test-'));
  const port = await freePort();
  const mongo = spawn('mongod', ['--dbpath', dir, '--port', String(port), '--bind_ip', '127.0.0.1', '--nounixsocket', '--quiet'], { stdio: 'ignore' });
  let spawnError;
  mongo.on('error', error => { spawnError = error; });
  t.after(async () => {
    await mongoose.disconnect();
    if (mongo.exitCode === null) {
      const exited = new Promise(resolve => mongo.once('exit', resolve));
      mongo.kill('SIGTERM'); await exited;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  let connected = false;
  for (let i = 0; i < 20; i++) {
    if (spawnError) throw spawnError;
    try { await mongoose.connect(`mongodb://127.0.0.1:${port}/auth_test`, { serverSelectionTimeoutMS: 500 }); connected = true; break; } catch { /* retry during mongod startup */ }
  }
  assert.ok(connected, 'disposable mongod must start');
  await Promise.all([Staff, Customer, Token, Session, Log, TokenUse].map(m => m.init()));
  const hashed = await bcrypt.hash(password, 12);
  const staff = await Staff.create({ email: 'admin@example.com', password: hashed, role: 'admin' });
  const customer = await Customer.create({ email: 'customer@example.com', password: hashed, profile: { name: 'Customer' } });
  await t.test('validation rejects malformed and operator input', async () => {
    assert.equal((await req('post', '/api/admin/auth/login').send({ email: { $ne: null }, password })).status, 400);
    assert.equal((await req('post', '/api/admin/auth/login').send({ email: 'bad', password })).status, 400);
    assert.equal((await req('post', '/api/auth/logout').set('Content-Type', 'application/json').send('{')).status, 400);
  });
  await t.test('unknown and wrong password responses match; cross-type login denied', async () => {
    const absent = await login('staff', 'missing@example.com');
    const wrong = await req('post', '/api/admin/auth/login').send({ email: staff.email, password: 'wrong' });
    assert.equal(absent.status, 401); assert.deepEqual(wrong.body, absent.body);
    assert.equal((await login('staff', customer.email)).status, 401);
    assert.equal((await login('customer', staff.email)).status, 401);
    assert.ok(await Log.findOne({ email: 'missing@example.com', reason: 'invalid_credentials' }));
  });
  await t.test('staff and customer sessions enforce type and role, hide secrets', async () => {
    const a = await login('staff', ' ADMIN@example.com ');
    const c = await login('customer', customer.email);
    assert.equal(a.status, 200); assert.equal(c.status, 200);
    assert.equal(a.body.user.role, 'admin'); assert.equal(c.body.user.type, 'customer');
    assert.equal(JSON.stringify(a.body).includes(hashed), false);
    assert.match(a.headers['set-cookie'].join(' '), /HttpOnly/); assert.match(a.headers['set-cookie'].join(' '), /SameSite=Strict/);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', cookies(a))).status, 200);
    assert.equal((await req('get', '/api/admin/auth/dashboard').set('Cookie', cookies(c))).status, 403);
    assert.equal((await req('get', '/api/auth/customer/portal').set('Cookie', cookies(a))).status, 403);
    assert.equal((await req('get', '/api/auth/me')).status, 401);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', 'auth_access=tampered')).status, 401);
    const agent = await Staff.create({ email: 'agent@example.com', password: hashed, role: 'agent' });
    const s = await login('staff', agent.email);
    assert.equal((await req('get', '/api/admin/auth/dashboard').set('Cookie', cookies(s))).status, 200);
    assert.equal((await req('get', '/api/admin/auth/admin-only').set('Cookie', cookies(s))).status, 403);
  });
  await t.test('inactive accounts and account lockout', async () => {
    await Customer.updateOne({ _id: customer._id }, { $set: { isActive: false } });
    assert.equal((await login('customer', customer.email)).status, 403);
    await Customer.updateOne({ _id: customer._id }, { $set: { isActive: true } });
    for (let i = 0; i < 10; i++) {
      assert.equal((await req('post', '/api/auth/customer/login').send({ email: customer.email, password: 'wrong' })).status, 401);
    }
    assert.equal((await login('customer', customer.email)).status, 429);
    let locked = await Customer.findById(customer._id);
    assert.equal(locked.failedLoginCount, 10); assert.ok(locked.lockUntil > new Date());
    await Customer.updateOne({ _id: customer._id }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    assert.equal((await login('customer', customer.email)).status, 200);
    locked = await Customer.findById(customer._id); assert.equal(locked.failedLoginCount, 0);
  });
  await t.test('email 2FA has no session until verification, bound one-use challenge, remembers choice', async () => {
    await Staff.updateOne({ _id: staff._id }, { $set: { twoFactorEnabled: true, twoFactorMethod: 'email' } });
    const challenge = await login('staff', staff.email, true);
    assert.equal(challenge.body.twoFactorRequired, true); assert.equal(cookie(challenge, 'auth_access'), undefined);
    const payload = jwt.decode(challenge.body.tempToken);
    assert.equal(payload.purpose, '2fa'); assert.equal(payload.role, undefined);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', `auth_access=${challenge.body.tempToken}`)).status, 401);
    const code = mails.at(-1).text.match(/code is (\d{6})/)[1];
    const stored = await Staff.findById(staff._id).select('+twoFactorCode'); assert.notEqual(stored.twoFactorCode, code);
    const body = { tempToken: challenge.body.tempToken, code };
    const invalidCode = code === '000000' ? '000001' : '000000';
    assert.equal((await req('post', '/api/admin/auth/verify-2fa').send({ ...body, code: invalidCode })).status, 401);
    const verified = await req('post', '/api/admin/auth/verify-2fa').send(body);
    assert.equal(verified.status, 200); assert.ok(cookie(verified, 'remember_token'));
    assert.equal((await req('post', '/api/admin/auth/verify-2fa').send(body)).status, 401);
    const next = await login('staff', staff.email);
    const expired = jwt.sign({ id: String(staff._id), purpose: '2fa' }, process.env.JWT_SECRET, { expiresIn: -1, issuer: 'isolated-auth', audience: 'auth-2fa' });
    assert.equal((await req('post', '/api/admin/auth/verify-2fa').send({ tempToken: expired, code })).status, 401);
    await Staff.updateOne({ _id: staff._id }, { $set: { twoFactorEnabled: false } });
    assert.equal((await req('post', '/api/admin/auth/verify-2fa').send({ tempToken: next.body.tempToken, code })).status, 401);
  });
  await t.test('TOTP encrypted at rest and time-step replay rejected', async () => {
    const secret = generateSecret(); const encrypted = encrypt(secret);
    assert.equal(decrypt(encrypted), secret); assert.notEqual(encrypted, secret);
    await Staff.updateOne({ _id: staff._id }, { $set: { twoFactorEnabled: true, twoFactorMethod: 'totp', twoFactorSecret: encrypted } });
    const challenge = await login('staff', staff.email);
    const code = await generateTotp({ secret });
    assert.equal((await req('post', '/api/admin/auth/verify-2fa').send({ tempToken: challenge.body.tempToken, code })).status, 200);
    const second = await login('staff', staff.email);
    assert.equal((await req('post', '/api/admin/auth/verify-2fa').send({ tempToken: second.body.tempToken, code })).status, 401);
    await Staff.updateOne({ _id: staff._id }, { $set: { twoFactorEnabled: false } });
  });
  await t.test('remember rotation, reuse detection and immediate session revocation', async () => {
    const signed = await login('customer', customer.email, true);
    const old = cookie(signed, 'remember_token');
    assert.ok(old); assert.equal((await Token.findOne({ userId: customer._id })).tokenHash.length, 64);
    const refreshed = await req('get', '/api/auth/refresh').set('Cookie', old);
    assert.equal(refreshed.status, 200); assert.notEqual(cookie(refreshed, 'remember_token'), old);
    assert.equal(await Token.countDocuments({ tokenHash: hash(old.split('=')[1]) }), 0);
    assert.equal((await req('get', '/api/auth/refresh').set('Cookie', old)).status, 401);
    assert.equal(await Token.countDocuments({ userId: customer._id }), 0);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', cookie(refreshed, 'auth_access'))).status, 401);
    assert.ok(await Log.findOne({ reason: 'remember_token_reuse' }));
  });
  await t.test('forgot generic response, strong password reset one-use, invalidates all sessions', async () => {
    const signed = await login('customer', customer.email, true);
    const known = await req('post', '/api/auth/forgot-password').send({ email: customer.email, type: 'customer' });
    const unknown = await req('post', '/api/auth/forgot-password').send({ email: 'missing@example.com', type: 'customer' });
    assert.equal(known.status, 200); assert.deepEqual(known.body, unknown.body);
    const resetMail = mails.findLast(m => m.subject === 'Reset your password');
    const url = new URL(resetMail.text.match(/https?:\/\/\S+/)[0]);
    const body = { ...Object.fromEntries(url.searchParams), password: 'NewStrongPass456' };
    const stored = await Customer.findById(customer._id).select('+resetPasswordToken');
    assert.equal(stored.resetPasswordToken, hash(body.token));
    assert.equal((await req('post', '/api/auth/reset-password').send({ ...body, password: 'weak' })).status, 400);
    assert.equal((await req('post', '/api/auth/reset-password').send(body)).status, 200);
    assert.equal((await req('post', '/api/auth/reset-password').send(body)).status, 400);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', cookie(signed, 'auth_access'))).status, 401);
    assert.equal((await req('get', '/api/auth/refresh').set('Cookie', cookie(signed, 'remember_token'))).status, 401);
    assert.equal((await login('customer', customer.email)).status, 401);
    assert.equal((await req('post', '/api/auth/customer/login').send({ email: customer.email, password: body.password })).status, 200);
    await Customer.updateOne({ _id: customer._id }, { $set: { password: hashed } });
  });
  await t.test('logout revokes only current device, preserves another device', async () => {
    const first = await login('customer', customer.email, true);
    const second = await login('customer', customer.email, true);
    assert.equal((await req('post', '/api/auth/logout').set('Cookie', cookies(first)).send({})).status, 200);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', cookie(first, 'auth_access'))).status, 401);
    assert.equal((await req('get', '/api/auth/me').set('Cookie', cookie(second, 'auth_access'))).status, 200);
    assert.equal((await req('get', '/api/auth/refresh').set('Cookie', cookie(first, 'remember_token'))).status, 401);
  });
  await t.test('strict origin checks, credential CORS, production HTTPS and secure cookies', async () => {
    assert.equal((await req('post', '/api/auth/customer/login').set('Origin', 'https://evil.example').send({ email: customer.email, password })).status, 403);
    const allowed = await req('options', '/api/auth/customer/login').set('Origin', process.env.FRONTEND_URL);
    assert.equal(allowed.status, 204); assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
    process.env.NODE_ENV = 'production'; process.env.FRONTEND_URL = 'https://crm.example.com';
    try {
      assert.equal((await req('get', '/api/auth/me')).status, 426);
      const secure = await req('post', '/api/auth/customer/login').set('X-Forwarded-Proto', 'https').send({ email: customer.email, password });
      assert.equal(secure.status, 200); assert.match(secure.headers['set-cookie'].join(' '), /Secure/);
    } finally { process.env.NODE_ENV = 'test'; process.env.FRONTEND_URL = 'http://localhost:5173'; }
  });
  await t.test('license CRUD, options, filtering and CSV require staff session and reject API-key bypass', async () => {
    const Client = require('../src/models/Client');
    const Product = require('../src/models/Product');
    const Project = require('../src/models/Project');
    const cid = new mongoose.Types.ObjectId();
    const pid = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    await Promise.all([
      Client.create({ _id: cid, userid: cid, company: 'Regression customer' }),
      Product.create({ _id: pid, id: pid, name: 'Regression product' }),
      Project.create({ _id: projectId, id: projectId, name: 'Regression project' })
    ]);
    const signed = await login('staff', staff.email);
    assert.equal(signed.status, 200);
    const staffCookies = cookies(signed);
    const legacy = (method, url) => req(method, url).set('Cookie', staffCookies);
    assert.equal((await req('get', '/api/licenses').set('Authorization', 'Bearer existing-api-key')).status, 401);
    const customerSession = await login('customer', customer.email);
    for (const [method, path] of [['get', '/api/licenses'], ['get', '/api/licenses/options'], ['get', '/api/licenses/export'], ['get', `/api/licenses/${cid}`], ['post', '/api/licenses'], ['put', `/api/licenses/${cid}`], ['post', '/api/licenses/bulk-delete']]) {
      let attempt = req(method, path).set('Cookie', cookies(customerSession));
      if (method !== 'get') attempt = attempt.send({});
      assert.equal((await attempt).status, 403, `${method} ${path} rejects a customer`);
    }
    assert.equal((await req('get', '/api/licenses')).status, 401);
    const options = await legacy('get', '/api/licenses/options');
    assert.equal(options.status, 200); assert.equal(options.body.status, 'success');
    const created = await legacy('post', '/api/licenses').send({ name: 'Regression license', domain: 'regression.example.com', product_id: String(pid), customer_id: String(cid), project_id: String(projectId), expiry_date: '2035-01-01', environment: 'Production', status: 'Active' });
    assert.equal(created.status, 201);
    const id = created.body.data._id;
    const detail = await legacy('get', `/api/licenses/${id}`);
    assert.equal(detail.status, 200); assert.equal(detail.body.data.name, 'Regression license');
    const listed = await legacy('get', '/api/licenses?search=Regression');
    assert.equal(listed.status, 200); assert.equal(listed.body.data.length, 1);
    assert.equal((await legacy('put', `/api/licenses/${id}`).send({ name: 'Updated regression license' })).status, 200);
    const exported = await legacy('get', '/api/licenses/export');
    assert.equal(exported.status, 200); assert.match(exported.text, /Updated regression license/);
    const deleted = await legacy('post', '/api/licenses/bulk-delete').send({ ids: [id] });
    assert.equal(deleted.status, 200); assert.equal(deleted.body.data.deleted, 1);
    assert.equal((await legacy('get', `/api/licenses/${id}`)).status, 404);
    await req('post', '/api/auth/logout').set('Cookie', staffCookies).send({});
    assert.equal((await legacy('get', '/api/licenses')).status, 401);
    assert.deepEqual((await req('get', '/health')).body, { status: 'ok' });
  });
  await t.test('IP login/forgot/2FA rate limits and audit trail', async () => {
    for (let i = 0; i < 5; i++) await req('post', '/api/auth/customer/login', '10.200.0.1').send({ email: 'unknown@example.com', password });
    assert.equal((await req('post', '/api/auth/customer/login', '10.200.0.1').send({ email: customer.email, password })).status, 429);
    for (let i = 0; i < 3; i++) await req('post', '/api/auth/forgot-password', '10.200.0.2').send({ email: 'unknown@example.com', type: 'customer' });
    assert.equal((await req('post', '/api/auth/forgot-password', '10.200.0.2').send({ email: customer.email, type: 'customer' })).status, 429);
    for (let i = 0; i < 5; i++) await req('post', '/api/admin/auth/verify-2fa', '10.200.0.3').send({ tempToken: 'invalid', code: '000000' });
    assert.equal((await req('post', '/api/admin/auth/verify-2fa', '10.200.0.3').send({ tempToken: 'invalid', code: '000000' })).status, 429);
    assert.ok(await Log.countDocuments({ success: false }) > 10);
  });
});
