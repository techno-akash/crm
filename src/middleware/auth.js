const config = require('../config');

function auth(req, res, next) {
  const header = req.get('authorization');
  if (!header) {
    return res.status(401).json({ status: 'unauthorized', error: 'API key missing' });
  }

  const bearerPrefix = 'Bearer ';
  const token = (header.startsWith(bearerPrefix) ? header.slice(bearerPrefix.length) : header).trim();
  if (!token || !config.timingSafeEqual(token, config.apiKey)) {
    return res.status(401).json({ status: 'unauthorized', error: 'Invalid API key' });
  }
  return next();
}

module.exports = auth;
