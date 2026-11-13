const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP,
} = require('./helpers');
const db = require('../wrapper/db');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

const requestRide = (rider) =>
  api().post('/api/rides').set(auth(rider.token))
    .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' });
const get = (user, path) => api().get(path).set(auth(user.token));

// Moves requested_at into the past instead of changing the timeout setting.
const backdate = (rideId) =>
  db.query("UPDATE rides SET requested_at = now() - interval '1 hour' WHERE id = $1", [rideId]);

async function setup() {
  const rider = await makeUser('rider');
  const driver = await makeUser('driver');
  await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
  const ride = (await requestRide(rider)).body.data;
  return { rider, driver, ride };
}

describe('lazy expiry of requested rides', () => {
  test('an old requested ride is cancelled by the system and logged', async () => {
    const { rider, ride } = await setup();
    await backdate(ride.id);
    const res = await get(rider, `/api/rides/${ride.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'cancelled');
    assert.equal(res.body.data.cancelled_by, 'system');
    const events = await db.query(
      "SELECT 1 FROM ride_events WHERE ride_id = $1 AND status = 'cancelled'", [ride.id]);
    assert.equal(events.rowCount, 1);
  });

  test('the rider can create a new ride after expiry', async () => {
    const { rider, ride } = await setup();
    await backdate(ride.id);
    const res = await requestRide(rider);
    assert.equal(res.status, 201);
    assert.notEqual(res.body.data.id, ride.id);
    assert.equal(res.body.data.status, 'requested');
  });

  test('an expired ride disappears from the nearby driver requests', async () => {
    const { driver, ride } = await setup();
    assert.equal((await get(driver, '/api/drivers/requests')).body.data.length, 1);
    await backdate(ride.id);
    assert.equal((await get(driver, '/api/drivers/requests')).body.data.length, 0);
  });

  test('an accepted ride with an old requested_at is not cancelled', async () => {
    const { rider, driver, ride } = await setup();
    const acc = await api().post(`/api/rides/${ride.id}/accept`).set(auth(driver.token));
    assert.equal(acc.status, 200);
    await backdate(ride.id);
    const res = await get(rider, `/api/rides/${ride.id}`);
    assert.equal(res.body.data.status, 'accepted');
    assert.equal(res.body.data.cancelled_by, null);
  });

  test('a fresh requested ride stays requested', async () => {
    const { rider, ride } = await setup();
    const res = await get(rider, `/api/rides/${ride.id}`);
    assert.equal(res.body.data.status, 'requested');
  });
});
