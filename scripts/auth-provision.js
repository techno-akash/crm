// Explicit operator command; never run automatically or against legacy collections.
require('dotenv').config();
const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { schemas } = require('../src/validators/auth.validators');
const { modelFor } = require('../src/services/auth.service');
const { encrypt } = require('../src/services/auth.crypto');
async function main() {
  require('../src/config/auth')();
  const [type, inputEmail, role = 'agent', method = 'none'] = process.argv.slice(2);
  if (!['staff', 'customer'].includes(type) || !['admin', 'agent'].includes(role) || !['none', 'email', 'totp'].includes(method)) {
    throw new Error('Usage: node scripts/auth-provision.js staff|customer email [admin|agent] [none|email|totp]');
  }
  const email = schemas.forgot.parse({ type, email: inputEmail }).email;
  // Read from stdin (pipe from a secret manager); never accept passwords in command arguments.
  if (process.stdin.isTTY) throw new Error('Pipe password and optional TOTP secret through stdin');
  const [password, secretInput] = fs.readFileSync(0, 'utf8').split(/\r?\n/);
  const parsed = schemas.reset.shape.password.parse(password);
  let secret;
  if (type === 'staff' && method === 'totp') {
    secret = secretInput;
    if (!/^[A-Z2-7]{32,}$/i.test(secret || '')) throw new Error('Use a base32 secret of at least 160 bits');
  }
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const Model = modelFor(type);
  await Model.init();
  const user = await Model.create({ email, password: await bcrypt.hash(parsed, 12),
    ...(type === 'staff' ? { role, twoFactorEnabled: method !== 'none', twoFactorMethod: method === 'totp' ? 'totp' : 'email',
      ...(secret ? { twoFactorSecret: encrypt(secret.toUpperCase()) } : {}) } : {}) });
  console.log(`Created ${type} account ${user._id}`);
}
main().catch(() => { console.error('Provisioning failed. Check input/configuration and ensure the email is unique.'); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
