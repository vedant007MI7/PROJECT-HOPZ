const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, cleanTables, makeUser, auth, closeDb, PICKUP, DROP } = require('./helpers');
const db = require('../wrapper/db');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

const book = (user, key, over = {}) => {
  const req = api().post('/api/rides').set(auth(user.token));
  if (key) req.set('Idempotency-Key', key);
  return req.send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini', ...over });
};

const rideCount = async (userId) =>
  Number((await db.query('SELECT count(*) FROM rides WHERE rider_id = $1', [userId])).rows[0].count);

describe('Idempotency-Key on POST /rides', () => {
  test('the same key twice gives the same ride and creates only one', async () => {
    const rider = await makeUser('rider');
    const first = await book(rider, 'key-aaaaaaaa-1');
    const second = await book(rider, 'key-aaaaaaaa-1');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(second.body.data.id, first.body.data.id);
    assert.equal(second.headers['idempotent-replay'], 'true');
    assert.equal(first.headers['idempotent-replay'], undefined);
    assert.equal(await rideCount(rider.user.id), 1);
  });

  test('without a key a repeat is still refused, as before', async () => {
    const rider = await makeUser('rider');
    assert.equal((await book(rider)).status, 201);
    assert.equal((await book(rider)).status, 409);
  });

  test('five requests sent at once with one key create one ride', async () => {
    const rider = await makeUser('rider');
    const results = await Promise.all(Array.from({ length: 5 }, () => book(rider, 'key-parallel-1')));
    const created = results.filter((r) => r.status === 201);
    assert.ok(created.length >= 1);
    // The rest either got the saved answer or were told the first one is still running.
    for (const r of results) assert.ok([201, 409].includes(r.status), `unexpected ${r.status}`);
    assert.equal(new Set(created.map((r) => r.body.data.id)).size, 1);
    assert.equal(await rideCount(rider.user.id), 1);
  });

  test('the same key with a different request is rejected', async () => {
    const rider = await makeUser('rider');
    await book(rider, 'key-aaaaaaaa-2');
    const res = await book(rider, 'key-aaaaaaaa-2', { vehicle_type: 'sedan' });
    assert.equal(res.status, 422);
  });

  test('a failed request frees the key so a corrected retry runs', async () => {
    const rider = await makeUser('rider');
    const bad = await book(rider, 'key-aaaaaaaa-3', { vehicle_type: 'rocket' });
    assert.equal(bad.status, 400);
    await new Promise((r) => setTimeout(r, 100)); // the key is released just after the answer is sent
    const good = await book(rider, 'key-aaaaaaaa-3');
    assert.equal(good.status, 201);
  });

  test('two users can use the same key', async () => {
    const a = await makeUser('rider');
    const b = await makeUser('rider');
    const ra = await book(a, 'key-shared-xx');
    const rb = await book(b, 'key-shared-xx');
    assert.equal(ra.status, 201);
    assert.equal(rb.status, 201);
    assert.notEqual(ra.body.data.id, rb.body.data.id);
  });

  test('a malformed key is a 400', async () => {
    const rider = await makeUser('rider');
    assert.equal((await book(rider, 'short')).status, 400);
  });
});
