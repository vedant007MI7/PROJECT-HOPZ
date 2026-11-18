const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP,
} = require('./helpers');
const redis = require('../wrapper/redis');
const cache = require('../wrapper/cache');
const { FakeRedis } = require('./fake-redis');

let fake;
beforeEach(async () => {
  await cleanTables();
  fake = new FakeRedis();
  redis.setClientForTests(fake);
  Object.assign(cache.stats, { hit: 0, miss: 0, error: 0 });
});
after(async () => {
  redis.setClientForTests(null);
  await cleanTables();
  await closeDb();
});

describe('cache-aside (B7)', () => {
  test('first call loads, second is served from Redis, del forgets', async () => {
    let loads = 0;
    const loader = async () => { loads += 1; return { n: loads }; };
    assert.deepEqual(await cache.getOrSet('k', 60, loader), { n: 1 });
    assert.deepEqual(await cache.getOrSet('k', 60, loader), { n: 1 });
    assert.equal(loads, 1);
    assert.deepEqual({ hit: cache.stats.hit, miss: cache.stats.miss }, { hit: 1, miss: 1 });

    await cache.del('k');
    assert.deepEqual(await cache.getOrSet('k', 60, loader), { n: 2 });
  });

  test('entries expire', async () => {
    let loads = 0;
    const loader = async () => { loads += 1; return loads; };
    await cache.getOrSet('short', 1, loader);
    fake.kv.get([...fake.kv.keys()].find((k) => k.endsWith('cache:short'))).until = Date.now() - 1;
    await cache.getOrSet('short', 1, loader);
    assert.equal(loads, 2);
  });

  test('concurrent misses share one loader call', async () => {
    let loads = 0;
    const loader = async () => { loads += 1; await new Promise((r) => setTimeout(r, 30)); return 'v'; };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => cache.getOrSet('same', 60, loader)));
    assert.deepEqual(results, ['v', 'v', 'v', 'v', 'v']);
    assert.equal(loads, 1);
  });

  test('when Redis is down the loader still answers', async () => {
    fake.failing = true;
    assert.equal(await cache.getOrSet('k', 60, async () => 'fresh'), 'fresh');
    assert.ok(cache.stats.error >= 1);
  });

  test('works with Redis switched off completely', async () => {
    redis.setClientForTests(null);
    assert.equal(await cache.getOrSet('k', 60, async () => 'fresh'), 'fresh');
  });

  test('a loader error is passed on and nothing is cached', async () => {
    await assert.rejects(cache.getOrSet('bad', 60, async () => { throw new Error('boom'); }), /boom/);
    assert.equal(await cache.getOrSet('bad', 60, async () => 'ok'), 'ok');
  });
});

describe('driver earnings cache', () => {
  async function finishedRide(rider, driver) {
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    const step = (name, body) => api().post(`/api/rides/${ride.id}/${name}`).set(auth(driver.token)).send(body);
    await step('accept');
    const pin = (await api().get(`/api/rides/${ride.id}`).set(auth(rider.token))).body.data.start_pin;
    await step('arrived');
    await step('start', { pin });
    return step('complete');
  }

  test('is cached, and completing a ride refreshes it at once', async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });

    const first = await api().get('/api/drivers/earnings').set(auth(driver.token));
    assert.equal(first.body.data.week, 0);
    await api().get('/api/drivers/earnings').set(auth(driver.token));
    assert.equal(cache.stats.hit, 1); // second call came from Redis

    const done = await finishedRide(rider, driver);
    assert.equal(done.status, 200);
    const after = await api().get('/api/drivers/earnings').set(auth(driver.token));
    assert.ok(after.body.data.week > 0); // not the stale 0
    assert.equal(after.body.data.rides.length, 1);
  });
});
