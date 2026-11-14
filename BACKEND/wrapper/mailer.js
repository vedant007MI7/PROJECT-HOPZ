const config = require('../config');
const logger = require('./logger');
const { withRetry, CircuitBreaker, TransientError, isTransient } = require('./resilience');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// If the email provider is down, stop waiting on it for every request: after 5 failures in a row, fail at once for 30 s.
const breaker = new CircuitBreaker({ name: 'Brevo', failureThreshold: 5, openMs: 30000 });

// Sends the password-reset code. With Brevo set up it is a real email; otherwise the code goes to the
// server log (fine for local development and demos, never for real users).
async function sendResetCode({ to, name, code, minutes }) {
  if (!config.brevoApiKey || !config.mailFrom) {
    logger.warn({ to, code }, 'Email is not configured: password reset code printed here instead');
    return;
  }
  const payload = JSON.stringify({
    sender: { name: config.mailFromName, email: config.mailFrom },
    to: [{ email: to, name }],
    subject: 'Your Hopz password reset code',
    htmlContent:
      `<p>Hi ${String(name || '').replace(/[<>&]/g, '')},</p>` +
      `<p>Your Hopz password reset code is:</p><h2 style="letter-spacing:4px">${code}</h2>` +
      `<p>It expires in ${minutes} minutes. If you did not ask for this, you can ignore this email.</p>`,
  });
  const attempt = async () => {
    let res;
    try {
      res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': config.brevoApiKey },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new TransientError('Email provider not reachable');
    }
    // 429 and 5xx mean "try later"; any other refusal is a real error (bad key, bad address).
    if (res.status >= 500 || res.status === 429) throw new TransientError(`Email provider answered ${res.status}`);
    if (!res.ok) throw new Error(`Email provider answered ${res.status}`);
  };
  await breaker.run(() => withRetry(attempt, { attempts: 2, baseMs: 300, shouldRetry: isTransient }), isTransient);
}

module.exports = { sendResetCode, breaker };
