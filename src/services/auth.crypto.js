const crypto = require('node:crypto');
const config = require('../config/auth');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
// Keyed hashing prevents offline brute force of six-digit codes after a DB leak.
const hashCode = value => crypto.createHmac('sha256', config().encryptionKey).update(value).digest('hex');
function encrypt(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config().encryptionKey, iv);
  return [iv.toString('hex'), cipher.update(secret, 'utf8', 'hex') + cipher.final('hex'), cipher.getAuthTag().toString('hex')].join(':');
}
function decrypt(value) {
  const [iv, ciphertext, tag] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', config().encryptionKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}
module.exports = { hash, hashCode, encrypt, decrypt };
