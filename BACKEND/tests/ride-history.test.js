const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, cleanTables, makeUser, auth, closeDb, PICKUP, DROP } = require('./helpers');
const db = require('../wrapper/db');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

// A rider can have one active ride, so each ride is cancelled before the next is requested.
async function riderWithRides(count) {
  const rider = await makeUser('rider');
  for (let i = 0; i < count; i += 1) {
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    await api().post(`/api/rides/${ride.id}/cancel`).set(auth(rider.token));
  }
  return rider;
}

const list = (user, query = '') => api().get(`/api/rides${query}`).set(auth(user.token));

describe('GET /rides cursor paging', () => {
  test('pages follow each other with no repeats and a null cursor at the end', async () => {
    const rider = await riderWithRides(5);
    const all = (await list(rider)).body.data.map((r) => r.id);
    assert.equal(all.length, 5);

    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const res = await list(rider, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      assert.equal(res.status, 200);
      seen.push(...res.body.data.map((r) => r.id));
      cursor = res.body.next_cursor;
      pages += 1;
    } while (cursor);

    assert.equal(pages, 3); // 2 + 2 + 1
    assert.deepEqual(seen, all);
  });

  test('rides with the same request time are not skipped or repeated', async () => {
    const rider = await riderWithRides(3);
    await db.query("UPDATE rides SET requested_at = '2026-01-01T00:00:00.000123Z' WHERE rider_id = $1", [rider.user.id]);
    const seen = [];
    let cursor = null;
    do {
      const res = await list(rider, `?limit=1${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...res.body.data.map((r) => r.id));
      cursor = res.body.next_cursor;
    } while (cursor);
    assert.equal(seen.length, 3);
    assert.equal(new Set(seen).size, 3);
  });

  test('a full page that is also the last one has no next cursor', async () => {
    const rider = await riderWithRides(2);
    const res = await list(rider, '?limit=2');
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.next_cursor, null);
  });

  test('a bad cursor, or a cursor with offset, is a 400', async () => {
    const rider = await riderWithRides(3);
    assert.equal((await list(rider, '?cursor=not-a-cursor')).status, 400);
    const good = (await list(rider, '?limit=1')).body.next_cursor;
    assert.equal((await list(rider, `?cursor=${good}&offset=1`)).status, 400);
  });

  test("a cursor cannot be used to see someone else's rides", async () => {
    const owner = await riderWithRides(3);
    const stranger = await makeUser('rider');
    const cursor = (await list(owner, '?limit=1')).body.next_cursor;
    const res = await list(stranger, `?cursor=${cursor}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });
});
