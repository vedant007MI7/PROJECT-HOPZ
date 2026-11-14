const config = require('../config');
const logger = require('./logger');

// Sends a one-time code to a phone number. The provider is chosen by SMS_PROVIDER.
// 'log' (the default) writes the code to the server log: fine for development and demos.
// Real SMS in India needs a DLT-registered provider (for example Fast2SMS); add it as another branch here.
async function sendCode({ to, code, minutes }) {
  if (config.smsProvider === 'log') {
    logger.warn({ to, code, minutes }, 'SMS provider is "log": password reset code printed here instead of sent');
    return;
  }
  throw new Error(`Unknown SMS provider: ${config.smsProvider}`);
}

module.exports = { sendCode };
