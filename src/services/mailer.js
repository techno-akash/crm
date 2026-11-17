const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
let transport;
function sendMail(to, subject, text) {
  // SMTP runs asynchronously; never expose message text, reset links or codes to logs.
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    logger.warn('Authentication email unavailable: configure SMTP_HOST and SMTP_FROM');
    return;
  }
  try {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.NODE_ENV === 'production',
    pool: true, maxConnections: 2, connectionTimeout: 10000, socketTimeout: 15000,
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {})
  });
  void transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text }).catch(() => logger.error('Authentication email delivery failed'));
  } catch { logger.error('Authentication email delivery failed'); }
}
module.exports = { sendMail };
