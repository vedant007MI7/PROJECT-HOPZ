const crypto = require('crypto');
const config = require('../config');
const AppError = require('../function/app-error');

const API = 'https://api.razorpay.com/v1';

// Creates an order for `amountPaise`. The app opens Razorpay checkout with the returned id.
async function createOrder({ amountPaise, receipt, notes }) {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new AppError('Online payments are not set up on this server', 503);
  }
  const basic = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
  let res;
  try {
    res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AppError('The payment provider is not reachable. Try again in a moment.', 502);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.id) {
    throw new AppError(json?.error?.description || 'Could not create the payment order', 502);
  }
  return { id: json.id, amount: json.amount, currency: json.currency };
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

module.exports = { createOrder, verifySignature };
