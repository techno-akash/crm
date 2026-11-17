// Kept separate from legacy API-key configuration; validated only for the new module.
function authConfig() {
  const secret = process.env.JWT_SECRET;
  const encryptionKey = process.env.AUTH_2FA_ENCRYPTION_KEY;
  const frontend = process.env.FRONTEND_URL;
  if (!secret || Buffer.byteLength(secret) < 32 || !/^[a-f\d]{64}$/i.test(encryptionKey || '') || !frontend) {
    throw new Error('Authentication configuration is incomplete');
  }
  const frontendUrl = new URL(frontend);
  const production = process.env.NODE_ENV === 'production';
  if (!['http:', 'https:'].includes(frontendUrl.protocol) || (production && frontendUrl.protocol !== 'https:')) {
    throw new Error('Invalid authentication frontend URL');
  }
  const origins = new Set([frontendUrl.origin, ...(process.env.AUTH_CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean)]);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || (production && url.protocol !== 'https:')) throw new Error('Invalid authentication origin');
  }
  return { secret, encryptionKey: Buffer.from(encryptionKey, 'hex'), frontend: frontendUrl.origin, origins, production };
}
module.exports = authConfig;
