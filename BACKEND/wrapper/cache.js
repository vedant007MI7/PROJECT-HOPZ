const redis = require('./redis');
const config = require('../config');
const logger = require('./logger');

// Cache-aside on Redis: look in the cache; on a miss run the loader (usually a database query), store the answer
// for a short time, and return it. Entries are also deleted explicitly when the data they hold changes.
//
//   getOrSet(key, ttlSeconds, loader)   -> the cached or freshly loaded value
//   del(key)                            -> forget a key (call it after the data changes)
//
// Rules:
// - Redis is optional. When it is off or down, every call simply runs the loader (nothing breaks, just no caching).
// - Two requests missing the same key at the same moment share ONE loader call in this process (no stampede).
// - Short lifetimes are the safety net: if a delete is ever missed, the value is wrong for at most `ttlSeconds`.

const stats = { hit: 0, miss: 0, error: 0 };
const inFlight = new Map(); // key -> Promise of a loader already running in this process
let lastWarn = 0;

function warn(err) {
  if (Date.now() - lastWarn < 30000) return;
  lastWarn = Date.now();
  logger.warn({ err: err.message }, 'Redis cache unavailable; reading from the database');
}

const full = (key) => `${config.redisKeyPrefix}cache:${key}`;

async function getOrSet(key, ttlSeconds, loader) {
  const k = full(key);
  try {
    const raw = await redis.run((c) => c.get(k));
    if (raw !== null) {
      stats.hit += 1;
      return JSON.parse(raw);
    }
  } catch (err) {
    stats.error += 1;
    warn(err);
  }
  stats.miss += 1;

  if (inFlight.has(k)) return inFlight.get(k);
  const p = (async () => {
    const value = await loader();
    try {
      await redis.run((c) => c.set(k, JSON.stringify(value), 'EX', ttlSeconds));
    } catch (err) {
      warn(err); // not cached this time; the answer is still correct
    }
    return value;
  })().finally(() => inFlight.delete(k));
  inFlight.set(k, p);
  return p;
}

async function del(key) {
  try {
    await redis.run((c) => c.del(full(key)));
  } catch (err) {
    warn(err); // the entry will expire on its own
  }
}

module.exports = { getOrSet, del, stats };
