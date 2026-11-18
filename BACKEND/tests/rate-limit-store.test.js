const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const { closeDb } = require('./helpers');
const redis = require('../wrapper/redis');
const RedisRateLimitStore = require('../wrapper/rate-limit-store');
const { FakeRedis } = require('./fake-redis');

let fake;
beforeEach(() => {
  fake = new FakeRedis();
  redis.setClientForTests(fake);
});
after(async () => {
  redis.setClientForTests(null);
  await closeDb();
});

const make = (windowMs = 60000) => {
  const s = new RedisRateLimitStore({ prefix: 't' });
  s.init({ windowMs });
  return s;
};

describe('RedisRateLimitStore (B6)', () => {
  test('counts hits per key in Redis and shares the count between instances', async () => {
    const a = make();
    const b = make(); // a second "server" using the same Redis
    assert.equal((await a.increment('u1')).totalHits, 1);
    assert.equal((await b.increment('u1')).totalHits, 2);
    assert.equal((await a.increment('u1')).totalHits, 3);
    assert.equal((await b.increment('u2')).totalHits, 1);
  });

  test('the count starts again after the window', async () => {
    const s = make(30);
    await s.increment('u1');
    await s.increment('u1');
    await new Promise((r) => setTimeout(r, 60));
    assert.equal((await s.increment('u1')).totalHits, 1);
  });

  test('decrement and resetKey', async () => {
    const s = make();
    await s.increment('u1');
    await s.increment('u1');
    await s.decrement('u1');
    assert.equal((await s.increment('u1')).totalHits, 2);
    await s.resetKey('u1');
    assert.equal((await s.increment('u1')).totalHits, 1);
  });

  test('resetTime is in the future, about one window away', async () => {
    const { resetTime } = await make(60000).increment('u1');
    const ms = resetTime.getTime() - Date.now();
    assert.ok(ms > 0 && ms <= 60000);
  });

  test('falls back to counting in memory when Redis is down', async () => {
    const s = make();
    fake.failing = true;
    assert.equal((await s.increment('u1')).totalHits, 1);
    assert.equal((await s.increment('u1')).totalHits, 2);
  });

  test('works with Redis switched off completely', async () => {
    redis.setClientForTests(null);
    const s = make();
    assert.equal((await s.increment('u1')).totalHits, 1);
    assert.equal((await s.increment('u1')).totalHits, 2);
  });
});
