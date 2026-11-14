const crypto = require('crypto');
const repo = require('../datadomain/idempotency.repository');
const AppError = require('../function/app-error');
const logger = require('../wrapper/logger');

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const KEEP_HOURS = 24;

// Makes a POST safe to retry. The client sends "Idempotency-Key: <random string>" and, if the connection drops,
// sends the same request again with the same key. The first request runs; a repeat gets the same answer back
// without running again. No header = the route behaves as before.
// Must come after requireAuth: keys are per user.
const idempotent = (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key) return next();
  if (!KEY_PATTERN.test(key)) throw new AppError('Idempotency-Key must be 8-100 letters, digits, - or _', 400);
  return handle(req, res, next, key).catch(next);
};

async function handle(req, res, next, key) {
  const userId = req.user.id;
  const route = `${req.method} ${req.baseUrl}${req.path}`;
  // Same key with a different body or a different ride is a client bug, not a retry.
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');

  const claim = await repo.claim({ userId, key, route, requestHash });
  if (!claim.claimed) {
    const prev = claim.row;
    if (!prev) return next(); // deleted between the two queries: just run it
    if (prev.route !== route || prev.request_hash !== requestHash) {
      throw new AppError('This Idempotency-Key was already used for a different request', 422);
    }
    if (prev.status === 'processing') {
      throw new AppError('The first request with this Idempotency-Key is still running, try again in a moment', 409);
    }
    res.set('Idempotent-Replay', 'true');
    return res.status(prev.response_status).json(prev.response_body);
  }

  // Remember the answer of this first run. Only successes are kept; after a failure the key is freed so a retry runs again.
  const send = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode;
    const saving = status >= 200 && status < 300
      ? repo.complete({ userId, key, responseStatus: status, responseBody: body })
      : repo.release({ userId, key });
    // Save first, then answer: a retry that arrives right away must find the finished result, not "processing".
    saving.catch((err) => logger.error({ err }, 'Could not save idempotency result')).finally(() => send(body));
    return res;
  };
  res.on('close', () => {
    // The connection ended without an answer: free the key.
    if (!res.writableEnded) repo.release({ userId, key }).catch(() => {});
  });

  if (Math.random() < 0.02) repo.deleteOlderThanHours(KEEP_HOURS).catch(() => {});
  return next();
}

module.exports = idempotent;
