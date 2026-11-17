const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.cookie', 'res.headers["set-cookie"]', 'req.headers.referer', 'req.headers.authorization', 'authorization', 'password', 'token', 'secret']
});
