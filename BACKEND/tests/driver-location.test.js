const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP,
} = require('./helpers');
const db = require('../wrapper/db');
const redis = require('../wrapper/redis');
const locationBusiness = require('../business/driver-location.business');
const { FakeRedis } = require('./fake-redis');

let fake;
beforeEach(async () => {
  await cleanTables();
  fake = new FakeRedis();
  redis.setClientForTests(fake);
});
after(async () => {
  redis.setClientForTests(null);
  await cleanTables();
  await closeDb();
});

const sendLocation = (driver, lat, lng) =>
  api().post('/api/drivers/location').set(auth(driver.token)).send({ lat, lng });
const dbLat = async (driver) =>
  (await db.query('SELECT lat FROM driver_profiles WHERE user_id = $1', [driver.user.id])).rows[0].lat;
const goOnline = (driver) =>
  api().post('/api/drivers/status').set(auth(driver.token)).send({ is_online: true });

describe('driver location in Redis (B5)', () => {
  test('first update saves to the database, later ones only to Redis', async () => {
    const driver = await makeUser('driver');
    const first = await sendLocation(driver, 28.6, 77.2);
    assert.equal(first.status, 200);
    assert.equal(await dbLat(driver), 28.6);

    const second = await sendLocation(driver, 28.61, 77.21);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.lat, 28.61); // the answer is the new point...
    assert.equal(await dbLat(driver), 28.6); // ...but the database was not written
    assert.equal((await locationBusiness.getLiveLocation(driver.user.id)).lat, 28.61);

    // Once the 60 s marker is gone the database is written again.
    fake.forgetSavedMarkers();
    await sendLocation(driver, 28.62, 77.22);
    assert.equal(await dbLat(driver), 28.62);
  });

  test('the rider sees the live position, not the saved one', async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    await api().post(`/api/rides/${ride.id}/accept`).set(auth(driver.token));

    await sendLocation(driver, 28.63, 77.22); // saved
    await sendLocation(driver, 28.64, 77.23); // Redis only
    const res = await api().get(`/api/rides/${ride.id}`).set(auth(rider.token));
    assert.equal(res.body.data.driver.location.lat, 28.64);
  });

  test("a driver's request list uses the live position", async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    await goOnline(driver);
    await sendLocation(driver, PICKUP.lat, PICKUP.lng); // saved: next to the pickup
    await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' });

    const near = await api().get('/api/drivers/requests').set(auth(driver.token));
    assert.equal(near.body.data.length, 1);

    await sendLocation(driver, 19.07, 72.87); // Mumbai, Redis only; the database still says Delhi
    const far = await api().get('/api/drivers/requests').set(auth(driver.token));
    assert.equal(far.body.data.length, 0);
  });

  test('going offline removes the driver from Redis at once', async () => {
    const driver = await makeUser('driver');
    await goOnline(driver);
    await sendLocation(driver, 28.6, 77.2);
    assert.equal((await locationBusiness.findNearbyDrivers({ lat: 28.6, lng: 77.2 })).length, 1);

    await api().post('/api/drivers/status').set(auth(driver.token)).send({ is_online: false });
    assert.equal(await locationBusiness.getLiveLocation(driver.user.id), null);
    assert.equal(fake.geo.size, 0);
  });

  test('when Redis is down every update goes to the database and still succeeds', async () => {
    const driver = await makeUser('driver');
    await sendLocation(driver, 28.6, 77.2);
    fake.failing = true;
    const res = await sendLocation(driver, 28.7, 77.3);
    assert.equal(res.status, 200);
    assert.equal(await dbLat(driver), 28.7);
    const again = await sendLocation(driver, 28.8, 77.3);
    assert.equal(again.status, 200);
    assert.equal(await dbLat(driver), 28.8);
  });

  test('works with Redis switched off completely', async () => {
    redis.setClientForTests(null);
    const driver = await makeUser('driver');
    await sendLocation(driver, 28.6, 77.2);
    const res = await sendLocation(driver, 28.7, 77.3);
    assert.equal(res.status, 200);
    assert.equal(await dbLat(driver), 28.7);
  });
});

describe('findNearbyDrivers', () => {
  async function driverAt(lat, lng, type = 'mini') {
    const d = await makeUser('driver', { vehicle_type: type });
    await goOnline(d);
    await sendLocation(d, lat, lng);
    return d;
  }

  test('nearest first, filtered by vehicle type and radius', async () => {
    const far = await driverAt(28.66, 77.22);
    const near = await driverAt(28.632, 77.217);
    await driverAt(28.633, 77.217, 'sedan');
    await driverAt(19.07, 72.87); // other city

    const all = await locationBusiness.findNearbyDrivers({ lat: PICKUP.lat, lng: PICKUP.lng, radiusKm: 10 });
    assert.equal(all.length, 3);
    assert.equal(all[0].driverId, near.user.id);
    assert.equal(all[2].driverId, far.user.id);

    const minis = await locationBusiness.findNearbyDrivers({
      lat: PICKUP.lat, lng: PICKUP.lng, radiusKm: 10, vehicleType: 'mini',
    });
    assert.deepEqual(minis.map((d) => d.type), ['mini', 'mini']);
  });

  test('a driver who stopped sending disappears and is cleaned out of the set', async () => {
    await driverAt(28.632, 77.217);
    fake.expireLiveKeys();
    const found = await locationBusiness.findNearbyDrivers({ lat: PICKUP.lat, lng: PICKUP.lng, radiusKm: 10 });
    assert.equal(found.length, 0);
    await new Promise((r) => setImmediate(r));
    assert.equal(fake.geo.size, 0);
  });

  test('falls back to the database when Redis is down', async () => {
    const near = await driverAt(28.632, 77.217);
    await driverAt(28.633, 77.217, 'sedan');
    fake.failing = true;
    const found = await locationBusiness.findNearbyDrivers({
      lat: PICKUP.lat, lng: PICKUP.lng, radiusKm: 10, vehicleType: 'mini',
    });
    assert.equal(found.length, 1);
    assert.equal(found[0].driverId, near.user.id);
  });
});
