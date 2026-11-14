const crypto = require('crypto');
const config = require('../config');
const AppError = require('../function/app-error');
const {
  withRetry, CircuitBreaker, CircuitOpenError, TransientError, isTransient,
} = require('./resilience');

const API = 'https://api.razorpay.com/v1';

// One breaker for all Razorpay calls: after 5 failures in a row we stop calling for 30 s and answer at once.
const breaker = new CircuitBreaker({ name: 'Razorpay', failureThreshold: 5, openMs: 30000 });

// One attempt. Network errors, timeouts and 5xx are "transient" (Razorpay is unhealthy: retry, count against
// the breaker). A 4xx means our request was wrong: no retry, and it does not trip the breaker.
async function requestOrder(basic, body) {
  let res;
  try {
    res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new TransientError('Razorpay not reachable');
  }
  const json = await res.json().catch(() => null);
  if (res.status >= 500) throw new TransientError(`Razorpay answered ${res.status}`);
  if (!res.ok || !json || !json.id) {
    throw new AppError(json?.error?.description || 'Could not create the payment order', 502);
  }
  return { id: json.id, amount: json.amount, currency: json.currency };
}

// Creates an order for `amountPaise`. The app opens Razorpay checkout with the returned id.
// Retrying is safe: the worst case is an unused extra order, and only one order per ride is ever stored.
async function createOrder({ amountPaise, receipt, notes }) {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new AppError('Online payments are not set up on this server', 503);
  }
  const basic = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
  const body = { amount: amountPaise, currency: 'INR', receipt, notes };
  try {
    return await breaker.run(
      () => withRetry(() => requestOrder(basic, body), { attempts: 2, baseMs: 300, shouldRetry: isTransient }),
      isTransient
    );
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      throw new AppError('Online payments are temporarily unavailable. Try again in a minute, or pay by cash.', 503);
    }
    if (isTransient(err)) throw new AppError('The payment provider is not reachable. Try again in a moment.', 502);
    throw err;
  }
}

// Razorpay signs "<order_id>|<payment_id>" with the key secret (HMAC SHA-256).
// Only the server knows the secret, so a valid signature proves the payment is real.
function verifySignature(orderId, paymentId, signature) {
  if (!config.razorpayKeySecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createOrder, verifySignature, breaker };
