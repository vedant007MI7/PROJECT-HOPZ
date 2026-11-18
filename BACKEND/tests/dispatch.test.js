const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const { api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP } = require('./helpers');
const db = require('../wrapper/db');
const config = require('../config');
const { allowedCount } = require('../business/dispatch.business');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

// Five mini drivers at 0.1, 0.2 ... 0.5 km from the pickup (index 0 = nearest).
async function fiveDrivers() {
  const drivers = [];
  for (let i = 0; i < 5; i += 1) {
    const d = await makeUser('driver');
    await setDriverState(d.user.id, { lat: PICKUP.lat + 0.001 * (i + 1), lng: PICKUP.lng });
    drivers.push(d);
  }
  return drivers;
}
const requestRide = async () => {
  const rider = await makeUser('rider');
  const res = await api().post('/api/rides').set(auth(rider.token))
    .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' });
  assert.equal(res.status, 201, `ride request failed: ${res.text}`);
  return res.body.data;
};
const sees = async (driver) => {
  const res = await api().get('/api/drivers/requests').set(auth(driver.token));
  assert.equal(res.status, 200, `requests failed: ${res.text}`);
  return res.body.data.length === 1;
};
const ageRide = (id, seconds) =>
  db.query("UPDATE rides SET requested_at = now() - ($2::int * interval '1 second') WHERE id = $1", [id, seconds]);

describe('dispatch in waves (B10)', () => {
  test('the wave grows with the age of the request', () => {
    assert.equal(allowedCount(0), 3);
    assert.equal(allowedCount(14), 3);
    assert.equal(allowedCount(15), 6);
    assert.equal(allowedCount(31), 9);
    assert.equal(allowedCount(60), Infinity);
  });

  test('a new request is shown to the nearest 3 drivers first, then to everyone', async () => {
    const drivers = await fiveDrivers();
    const ride = await requestRide();
    assert.deepEqual(await Promise.all(drivers.map(sees)), [true, true, true, false, false]);

    await ageRide(ride.id, 20); // second wave: 6 drivers
    assert.deepEqual(await Promise.all(drivers.map(sees)), [true, true, true, true, true]);
  });

  test('a driver who declined does not use up a place in the wave', async () => {
    const drivers = await fiveDrivers();
    const ride = await requestRide();
    await api().post(`/api/rides/${ride.id}/decline`).set(auth(drivers[0].token));
    // Nearest declined: drivers 1, 2, 3 are now the first three in line.
    assert.deepEqual(await Promise.all(drivers.map(sees)), [false, true, true, true, false]);
  });

  test('after the full-wave time everyone in range sees it', async () => {
    const drivers = await fiveDrivers();
    const ride = await requestRide();
    await ageRide(ride.id, 61);
    assert.equal(await sees(drivers[4]), true);
  });

  test('with the wave size 0 every driver sees a new request at once', async () => {
    const drivers = await fiveDrivers();
    await requestRide();
    const saved = config.dispatchWaveSize;
    config.dispatchWaveSize = 0;
    try {
      assert.equal(await sees(drivers[4]), true);
    } finally {
      config.dispatchWaveSize = saved;
    }
  });

  test('a driver the nearby search cannot place still sees the ride (fail open)', async () => {
    const drivers = await fiveDrivers();
    await requestRide();
    // Their saved position is old, so the database search leaves them out of the line.
    await db.query("UPDATE driver_profiles SET location_updated_at = now() - interval '10 minutes' WHERE user_id = $1", [drivers[4].user.id]);
    assert.equal(await sees(drivers[4]), true);
  });
});
