const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'authorization', 'password', 'token', 'secret']
});
