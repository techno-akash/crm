const config = require('../config');

function auth(req, res, next) {
  const header = req.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'unauthorized', error: 'API key missing' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token || !config.timingSafeEqual(token, config.apiKey)) {
    return res.status(401).json({ status: 'unauthorized', error: 'Invalid API key' });
  }
  return next();
}

module.exports = auth;
