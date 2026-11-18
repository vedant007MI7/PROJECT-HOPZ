const redis = require('./redis');
const config = require('../config');
const logger = require('./logger');

// A counter store for express-rate-limit that lives in Redis, so every server instance shares one count.
// (The default store keeps counts in each process's memory: with 3 instances a "20 per 15 min" limit is really 60.)
//
// Redis is optional. When it is off or down, this falls back to counting in this process's memory, which is
// exactly how rate limiting worked before: the limit is still enforced, just per instance.
class RedisRateLimitStore {
  constructor({ prefix }) {
    this.prefix = `${config.redisKeyPrefix}rl:${prefix}:`;
    this.windowMs = 60000;
    this.local = new Map(); // key -> { hits, resetTime }
    this.lastWarn = 0;
    // Tells express-rate-limit this store is shared, so it does not run its own per-process bookkeeping.
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const k = this.prefix + key;
    try {
      // One round trip: create the key with a lifetime if it is new, count this hit, read the time left.
      const res = await redis.run((c) => c.pipeline()
        .set(k, 0, 'PX', this.windowMs, 'NX')
        .incr(k)
        .pttl(k)
        .exec());
      for (const [err] of res) if (err) throw err;
      const ttl = res[2][1] > 0 ? res[2][1] : this.windowMs;
      return { totalHits: Number(res[1][1]), resetTime: new Date(Date.now() + ttl) };
    } catch (err) {
      this.warn(err);
      return this.incrementLocal(k);
    }
  }

  incrementLocal(k) {
    const now = Date.now();
    let entry = this.local.get(k);
    if (!entry || entry.resetTime <= now) {
      if (this.local.size > 10000) this.local.clear(); // keep memory bounded
      entry = { hits: 0, resetTime: now + this.windowMs };
      this.local.set(k, entry);
    }
    entry.hits += 1;
    return { totalHits: entry.hits, resetTime: new Date(entry.resetTime) };
  }

  async decrement(key) {
    const k = this.prefix + key;
    const entry = this.local.get(k);
    if (entry && entry.hits > 0) entry.hits -= 1;
    try {
      await redis.run((c) => c.decr(k));
    } catch (err) {
      this.warn(err);
    }
  }

  async resetKey(key) {
    const k = this.prefix + key;
    this.local.delete(k);
    try {
      await redis.run((c) => c.del(k));
    } catch (err) {
      this.warn(err);
    }
  }

  warn(err) {
    if (Date.now() - this.lastWarn < 30000) return;
    this.lastWarn = Date.now();
    logger.warn({ err: err.message }, 'Redis rate limit store unavailable; counting in memory');
  }
}

module.exports = RedisRateLimitStore;
