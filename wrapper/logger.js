const pino = require('pino');
const config = require('../config');

module.exports = pino({
  level: config.nodeEnv === 'test' ? 'silent' : 'info',
  // Never log credentials, even if a request is logged by mistake.
  redact: ['req.headers.authorization', 'password', 'password_hash'],
});
