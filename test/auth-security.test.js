const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { schemas } = require('../src/validators/auth.validators');
test('shared logger redacts auth cookies and reset-link referers', () => {
  const result = spawnSync(process.execPath, ['-e', `require('./src/utils/logger').info({req:{headers:{cookie:'secret-cookie',authorization:'secret-header',referer:'https://example.com/reset-password?token=secret-reset'}},res:{headers:{'set-cookie':['secret-set-cookie']}}},'redaction check')`], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8', env: { ...process.env, LOG_LEVEL: 'info' } });
  assert.equal(result.status, 0);
  const logged = JSON.parse(result.stdout);
  assert.equal(logged.req.headers.cookie, '[Redacted]');
  assert.equal(logged.req.headers.referer, '[Redacted]');
  assert.equal(logged.res.headers['set-cookie'], '[Redacted]');
  assert.equal(result.stdout.includes('secret-'), false);
});
test('bcrypt input limits count UTF-8 bytes and enforce strength', () => {
  const password = schemas.reset.shape.password;
  assert.equal(password.safeParse('Aa123456').success, true);
  assert.equal(password.safeParse('Aa1' + 'é'.repeat(35)).success, false);
  assert.equal(password.safeParse('lowercase123').success, false);
});
test('mailer swallows synchronous transport failures and asynchronous SMTP rejection', async () => {
  process.env.SMTP_HOST = 'smtp.example.invalid';
  process.env.SMTP_FROM = 'no-reply@example.invalid';
  const nodemailer = require('nodemailer');
  const original = nodemailer.createTransport;
  const originalLog = require('../src/utils/logger').error;
  const failures = [];
  require('../src/utils/logger').error = message => failures.push(message);
  try {
    const mailer = require('../src/services/mailer');
    nodemailer.createTransport = () => { throw new Error('Do not log message contents'); };
    assert.doesNotThrow(() => mailer.sendMail('a@example.com', 'subject', 'secret reset link'));
    nodemailer.createTransport = () => ({ sendMail: () => Promise.reject(new Error('secret SMTP credentials')) });
    assert.doesNotThrow(() => mailer.sendMail('a@example.com', 'subject', 'secret reset link'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failures.length, 2);
    assert.equal(failures.join().includes('secret'), false);
  } finally { nodemailer.createTransport = original; require('../src/utils/logger').error = originalLog; }
});
