const crypto = require('crypto');
const { PIN } = require('./constants');

// crypto.randomInt, not Math.random: the PIN is a secret.
function generatePin() {
  return String(crypto.randomInt(0, 10 ** PIN.LENGTH)).padStart(PIN.LENGTH, '0');
}

module.exports = { generatePin };
