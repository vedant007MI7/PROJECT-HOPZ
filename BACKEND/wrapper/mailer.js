const config = require('../config');
const logger = require('./logger');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// Sends the password-reset code. With Brevo set up it is a real email; otherwise the code goes to the
// server log (fine for local development and demos, never for real users).
async function sendResetCode({ to, name, code, minutes }) {
  if (!config.brevoApiKey || !config.mailFrom) {
    logger.warn({ to, code }, 'Email is not configured: password reset code printed here instead');
    return;
  }
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': config.brevoApiKey },
    body: JSON.stringify({
      sender: { name: config.mailFromName, email: config.mailFrom },
      to: [{ email: to, name }],
      subject: 'Your Hopz password reset code',
      htmlContent:
        `<p>Hi ${String(name || '').replace(/[<>&]/g, '')},</p>` +
        `<p>Your Hopz password reset code is:</p><h2 style="letter-spacing:4px">${code}</h2>` +
        `<p>It expires in ${minutes} minutes. If you did not ask for this, you can ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Email provider answered ${res.status}`);
}

module.exports = { sendResetCode };
