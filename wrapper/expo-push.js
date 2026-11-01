const logger = require('./logger');

// Stub: log only. Later, POST to https://exp.host/--/api/v2/push/send.
async function sendPush(tokens, { title, body, data } = {}) {
  logger.info({ tokens, title, body, data }, 'push (stub, not sent)');
  return { sent: 0 };
}

module.exports = { sendPush };
