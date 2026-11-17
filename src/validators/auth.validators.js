const { z } = require('zod');
const email = z.string().trim().toLowerCase().max(254).email();
const password = z.string().min(8).max(72).refine(v => Buffer.byteLength(v) <= 72, 'Password must be at most 72 bytes')
  .regex(/[a-z]/, 'Include a lowercase letter').regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number');
const type = z.enum(['staff', 'customer']);
const schemas = {
  login: z.object({ email, password: z.string().min(1).max(256), rememberMe: z.boolean().default(false) }).strict(),
  verify: z.object({ tempToken: z.string().min(1).max(2048), code: z.string().regex(/^\d{6}$/) }).strict(),
  forgot: z.object({ email, type }).strict(),
  reset: z.object({ type, userId: z.string().regex(/^[a-f\d]{24}$/i), token: z.string().regex(/^[a-f\d]{64}$/i), password }).strict(),
  empty: z.object({}).strict()
};
function validate(name, location = 'body') {
  return async (req, res, next) => {
    const parsed = schemas[name].safeParse(req[location] || {});
    if (!parsed.success) {
      try {
        const type = req.originalUrl.startsWith('/api/admin/') ? 'staff' : req.body?.type === 'staff' ? 'staff' : 'customer';
        await require('../services/auth.service').audit(req, false, 'invalid_auth_request', null, type);
      } catch (error) { return next(error); }
      return res.status(400).json({ message: 'Invalid request', errors: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
    }
    req[location] = parsed.data;
    next();
  };
}
module.exports = { validate, schemas };
