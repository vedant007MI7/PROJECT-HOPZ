const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP,
} = require('./helpers');
const config = require('../config');
const { calculateFare } = require('../function/fare');
const { haversineKm } = require('../function/geo');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

const requestRide = (rider, over = {}) =>
  api().post('/api/rides').set(auth(rider.token))
    .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini', ...over });

const post = (user, path, body) => api().post(`/api/rides/${path}`).set(auth(user.token)).send(body);
const get = (user, path) => api().get(path).set(auth(user.token));

// A rider with a requested ride and an online driver (mini) parked at the pickup point.
async function setup() {
  const rider = await makeUser('rider');
  const driver = await makeUser('driver');
  await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
  const ride = (await requestRide(rider)).body.data;
  return { rider, driver, ride };
}

async function acceptedRide() {
  const ctx = await setup();
  await post(ctx.driver, `${ctx.ride.id}/accept`);
  return ctx;
}

// Rider's view of the ride holds the PIN.
const pinOf = async (rider, rideId) => (await get(rider, `/api/rides/${rideId}`)).body.data.start_pin;

describe('POST /rides (#6)', () => {
  test('creates a requested ride; fare and distance come from the server', async () => {
    const rider = await makeUser('rider');
    // A client-sent fare must be ignored.
    const res = await requestRide(rider, { fare: 1, distance_km: 0.1 });
    assert.equal(res.status, 201);
    const km = Math.round(haversineKm(PICKUP.lat, PICKUP.lng, DROP.lat, DROP.lng) * 100) / 100;
    assert.equal(res.body.data.status, 'requested');
    assert.equal(res.body.data.distance_km, km);
    assert.equal(res.body.data.fare, calculateFare('mini', km));
    assert.equal(res.body.data.driver, null);
  });

  test('a rider cannot have two active rides (409)', async () => {
    const rider = await makeUser('rider');
    assert.equal((await requestRide(rider)).status, 201);
    assert.equal((await requestRide(rider)).status, 409);
  });

  test('two requests at once still create only one ride', async () => {
    const rider = await makeUser('rider');
    const results = await Promise.all([requestRide(rider), requestRide(rider)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  });

  test('drivers get 403, bad input gets 400', async () => {
    const driver = await makeUser('driver');
    const rider = await makeUser('rider');
    assert.equal((await requestRide(driver)).status, 403);
    assert.equal((await requestRide(rider, { vehicle_type: 'bike' })).status, 400);
    assert.equal((await requestRide(rider, { pickup: { text: 'x', lat: 999, lng: 0 } })).status, 400);
  });
});

describe('GET /rides/:id (#7)', () => {
  test('rider sees start_pin and the driver once accepted; the driver never sees the PIN', async () => {
    const { rider, driver, ride } = await acceptedRide();
    const asRider = (await get(rider, `/api/rides/${ride.id}`)).body.data;
    assert.match(asRider.start_pin, /^\d{4}$/);
    assert.equal(asRider.driver.id, driver.user.id);
    assert.equal(asRider.driver.vehicle_type, 'mini');

    const asDriver = (await get(driver, `/api/rides/${ride.id}`)).body.data;
    assert.equal(asDriver.start_pin, undefined);
  });

  test("someone else's ride and unknown ids are 404, a malformed id is 400", async () => {
    const { ride } = await setup();
    const stranger = await makeUser('rider');
    const otherDriver = await makeUser('driver');
    assert.equal((await get(stranger, `/api/rides/${ride.id}`)).status, 404);
    assert.equal((await get(otherDriver, `/api/rides/${ride.id}`)).status, 404);
    assert.equal((await get(stranger, '/api/rides/00000000-0000-4000-8000-000000000000')).status, 404);
    assert.equal((await get(stranger, '/api/rides/nope')).status, 400);
  });
});

describe('POST /rides/:id/accept (#10)', () => {
  test('first driver wins and the PIN is created', async () => {
    const { driver, ride } = await setup();
    const res = await post(driver, `${ride.id}/accept`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'accepted');
    assert.equal(res.body.data.driver_id, driver.user.id);
  });

  test('two drivers accepting at once: exactly one wins', async () => {
    const { ride } = await setup();
    const d1 = await makeUser('driver');
    const d2 = await makeUser('driver');
    await setDriverState(d1.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    await setDriverState(d2.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    const results = await Promise.all([post(d1, `${ride.id}/accept`), post(d2, `${ride.id}/accept`)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  });

  test('offline driver, busy driver, wrong vehicle, wrong role, unknown ride', async () => {
    const { rider, driver, ride } = await setup();
    const offline = await makeUser('driver');
    assert.equal((await post(offline, `${ride.id}/accept`)).status, 409);

    assert.equal((await post(rider, `${ride.id}/accept`)).status, 403);
    assert.equal((await post(driver, '00000000-0000-4000-8000-000000000000/accept')).status, 404);

    const auto = await makeUser('driver', { vehicle_type: 'auto' });
    await setDriverState(auto.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    assert.equal((await post(auto, `${ride.id}/accept`)).status, 409);

    // A driver already on a ride cannot take a second one.
    assert.equal((await post(driver, `${ride.id}/accept`)).status, 200);
    const rider2 = await makeUser('rider');
    const ride2 = (await requestRide(rider2)).body.data;
    assert.equal((await post(driver, `${ride2.id}/accept`)).status, 409);
  });

  test('an already accepted ride cannot be accepted again', async () => {
    const { ride } = await acceptedRide();
    const other = await makeUser('driver');
    await setDriverState(other.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    assert.equal((await post(other, `${ride.id}/accept`)).status, 409);
  });
});

describe('POST /rides/:id/decline (#11) and GET /drivers/requests (#17)', () => {
  test('a declined ride stays open for others and vanishes for the decliner', async () => {
    const { driver, ride } = await setup();
    const other = await makeUser('driver');
    await setDriverState(other.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });

    assert.equal((await get(driver, '/api/drivers/requests')).body.data.length, 1);
    const res = await post(driver, `${ride.id}/decline`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { declined: true });

    assert.equal((await get(driver, '/api/drivers/requests')).body.data.length, 0);
    assert.equal((await get(other, '/api/drivers/requests')).body.data.length, 1);
    assert.equal((await get(driver, `/api/rides/${ride.id}`)).status, 404);
  });

  test('requests: nearest only, matching vehicle, empty when offline, no PIN leaked', async () => {
    const { driver, ride } = await setup();
    const list = (await get(driver, '/api/drivers/requests')).body.data;
    assert.equal(list[0].id, ride.id);
    assert.equal(list[0].pickup_distance_km, 0);
    assert.equal(list[0].start_pin, undefined);

    // ~110 km away: outside NEARBY_RADIUS_KM.
    await setDriverState(driver.user.id, { lat: PICKUP.lat + 1, lng: PICKUP.lng });
    assert.equal((await get(driver, '/api/drivers/requests')).body.data.length, 0);

    // Wrong vehicle type for the ride.
    const auto = await makeUser('driver', { vehicle_type: 'auto' });
    await setDriverState(auto.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    assert.equal((await get(auto, '/api/drivers/requests')).body.data.length, 0);

    // Offline.
    await setDriverState(driver.user.id, { online: false, lat: PICKUP.lat, lng: PICKUP.lng });
    assert.deepEqual((await get(driver, '/api/drivers/requests')).body.data, []);
  });

  test('declining a ride that is no longer open is 409', async () => {
    const { ride } = await acceptedRide();
    const other = await makeUser('driver');
    assert.equal((await post(other, `${ride.id}/decline`)).status, 409);
  });
});

describe('arrived (#12), start (#13), complete (#14)', () => {
  test('the full trip: arrived, wrong PIN, right PIN, complete', async () => {
    const { rider, driver, ride } = await acceptedRide();

    assert.equal((await post(driver, `${ride.id}/start`, { pin: '0000' })).status, 409); // not arrived yet
    assert.equal((await post(driver, `${ride.id}/arrived`)).body.data.status, 'arrived');

    const pin = await pinOf(rider, ride.id);
    const wrong = pin === '0000' ? '1111' : '0000';
    const bad = await post(driver, `${ride.id}/start`, { pin: wrong });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /Wrong PIN/);
    assert.equal((await post(driver, `${ride.id}/start`, { pin: 'abc' })).status, 400);

    const started = await post(driver, `${ride.id}/start`, { pin });
    assert.equal(started.status, 200);
    assert.equal(started.body.data.status, 'started');

    const done = await post(driver, `${ride.id}/complete`);
    assert.equal(done.status, 200);
    assert.equal(done.body.data.status, 'completed');
    assert.ok(done.body.data.completed_at);
  });

  test('the PIN locks with 423 after PIN_MAX_ATTEMPTS wrong tries, even for the right PIN', async () => {
    const { rider, driver, ride } = await acceptedRide();
    await post(driver, `${ride.id}/arrived`);
    const pin = await pinOf(rider, ride.id);
    const wrong = pin === '0000' ? '1111' : '0000';

    for (let i = 1; i < config.pinMaxAttempts; i += 1) {
      assert.equal((await post(driver, `${ride.id}/start`, { pin: wrong })).status, 400);
    }
    assert.equal((await post(driver, `${ride.id}/start`, { pin: wrong })).status, 423);
    assert.equal((await post(driver, `${ride.id}/start`, { pin })).status, 423);
  });

  test('only the ride\'s own driver can move it (404 for others, 403 for riders)', async () => {
    const { rider, ride } = await acceptedRide();
    const other = await makeUser('driver');
    assert.equal((await post(other, `${ride.id}/arrived`)).status, 404);
    assert.equal((await post(rider, `${ride.id}/arrived`)).status, 403);
  });

  test('steps cannot be skipped', async () => {
    const { driver, ride } = await acceptedRide();
    assert.equal((await post(driver, `${ride.id}/complete`)).status, 409);
  });
});

describe('POST /rides/:id/cancel (#9)', () => {
  test('rider cancels a requested ride; cancelled_by is saved', async () => {
    const { rider, ride } = await setup();
    const res = await post(rider, `${ride.id}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'cancelled');
    assert.equal(res.body.data.cancelled_by, 'rider');
    // Cancelling frees the rider to book again.
    assert.equal((await requestRide(rider)).status, 201);
  });

  test('driver cancels an accepted ride', async () => {
    const { driver, ride } = await acceptedRide();
    const res = await post(driver, `${ride.id}/cancel`);
    assert.equal(res.body.data.cancelled_by, 'driver');
  });

  test('refused once started, and for strangers', async () => {
    const { rider, driver, ride } = await acceptedRide();
    const stranger = await makeUser('rider');
    assert.equal((await post(stranger, `${ride.id}/cancel`)).status, 404);

    await post(driver, `${ride.id}/arrived`);
    await post(driver, `${ride.id}/start`, { pin: await pinOf(rider, ride.id) });
    assert.equal((await post(rider, `${ride.id}/cancel`)).status, 409);
    assert.equal((await post(driver, `${ride.id}/cancel`)).status, 409);
  });
});

describe('GET /rides (#8)', () => {
  test('own rides only, newest first, filterable and paged', async () => {
    const rider = await makeUser('rider');
    const first = (await requestRide(rider)).body.data;
    await post(rider, `${first.id}/cancel`);
    const second = (await requestRide(rider)).body.data;
    const stranger = await makeUser('rider');

    const all = (await get(rider, '/api/rides')).body.data;
    assert.deepEqual(all.map((r) => r.id), [second.id, first.id]);
    assert.equal((await get(stranger, '/api/rides')).body.data.length, 0);

    const cancelled = (await get(rider, '/api/rides?status=cancelled')).body.data;
    assert.deepEqual(cancelled.map((r) => r.id), [first.id]);
    assert.equal((await get(rider, '/api/rides?limit=1&offset=1')).body.data[0].id, first.id);
    assert.equal((await get(rider, '/api/rides?status=flying')).status, 400);
    assert.equal((await get(rider, '/api/rides?limit=0')).status, 400);
  });

  test('a driver sees the rides they accepted', async () => {
    const { driver, ride } = await acceptedRide();
    const list = (await get(driver, '/api/rides')).body.data;
    assert.deepEqual(list.map((r) => r.id), [ride.id]);
  });
});

describe('POST /rides/:id/rating (#15) and GET /drivers/earnings (#19)', () => {
  async function completedRide() {
    const ctx = await acceptedRide();
    await post(ctx.driver, `${ctx.ride.id}/arrived`);
    await post(ctx.driver, `${ctx.ride.id}/start`, { pin: await pinOf(ctx.rider, ctx.ride.id) });
    await post(ctx.driver, `${ctx.ride.id}/complete`);
    return ctx;
  }

  test('rate once after completion; a second rating is 409', async () => {
    const { rider, ride } = await completedRide();
    const res = await post(rider, `${ride.id}/rating`, { stars: 5, tip: 20, comment: 'Smooth' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.stars, 5);
    assert.equal(res.body.data.tip, 20);
    assert.equal((await post(rider, `${ride.id}/rating`, { stars: 4 })).status, 409);
  });

  test('not before completion, not by others, validated input', async () => {
    const early = await acceptedRide();
    assert.equal((await post(early.rider, `${early.ride.id}/rating`, { stars: 5 })).status, 409);

    const { rider, driver, ride } = await completedRide();
    const stranger = await makeUser('rider');
    assert.equal((await post(stranger, `${ride.id}/rating`, { stars: 5 })).status, 404);
    assert.equal((await post(driver, `${ride.id}/rating`, { stars: 5 })).status, 403);
    assert.equal((await post(rider, `${ride.id}/rating`, { stars: 6 })).status, 400);
    assert.equal((await post(rider, `${ride.id}/rating`, { stars: 5, tip: -1 })).status, 400);
  });

  test('driver profile shows the average rating; only the ride driver sees the rider phone', async () => {
    const { rider, driver, ride } = await completedRide();
    const before = (await get(driver, '/api/users/me')).body.data.driver_profile.rating;
    assert.deepEqual(before, { average: null, count: 0 });

    await post(rider, `${ride.id}/rating`, { stars: 4 });
    const after = (await get(driver, '/api/users/me')).body.data.driver_profile.rating;
    assert.deepEqual(after, { average: 4, count: 1 });

    const asDriver = (await get(driver, `/api/rides/${ride.id}`)).body.data;
    assert.equal(asDriver.rider.name, rider.user.name);
    const asRider = (await get(rider, `/api/rides/${ride.id}`)).body.data;
    assert.equal(asRider.rider, undefined);
  });

  test('earnings count completed rides today and this week', async () => {
    const empty = await makeUser('driver');
    assert.deepEqual((await get(empty, '/api/drivers/earnings')).body.data, { today: 0, week: 0, rides: [] });

    const { driver, ride } = await completedRide();
    const res = (await get(driver, '/api/drivers/earnings')).body.data;
    assert.equal(res.today, ride.fare);
    assert.equal(res.week, ride.fare);
    assert.equal(res.rides.length, 1);
    assert.equal(res.rides[0].id, ride.id);
  });
});

describe('driver status (#16) and location (#18)', () => {
  test('goes online and offline, and saves its location', async () => {
    const driver = await makeUser('driver');
    const on = await api().post('/api/drivers/status').set(auth(driver.token)).send({ is_online: true });
    assert.equal(on.body.data.is_online, true);

    const loc = await api().post('/api/drivers/location').set(auth(driver.token))
      .send({ lat: 28.6, lng: 77.2 });
    assert.equal(loc.status, 200);
    assert.equal(loc.body.data.lat, 28.6);
    assert.ok(loc.body.data.location_updated_at);

    const off = await api().post('/api/drivers/status').set(auth(driver.token)).send({ is_online: false });
    assert.equal(off.body.data.is_online, false);
  });

  test('cannot go offline during an active ride; bad input is 400', async () => {
    const { driver } = await acceptedRide();
    const res = await api().post('/api/drivers/status').set(auth(driver.token)).send({ is_online: false });
    assert.equal(res.status, 409);

    const bad = await api().post('/api/drivers/status').set(auth(driver.token)).send({ is_online: 'yes' });
    assert.equal(bad.status, 400);
    const badLoc = await api().post('/api/drivers/location').set(auth(driver.token)).send({ lat: 95, lng: 0 });
    assert.equal(badLoc.status, 400);
  });

  test('riders get 403', async () => {
    const rider = await makeUser('rider');
    const res = await api().post('/api/drivers/status').set(auth(rider.token)).send({ is_online: true });
    assert.equal(res.status, 403);
  });
});

describe('POST /push-tokens (#20)', () => {
  test('saves a token, updates its platform, and moves it between users', async () => {
    const a = await makeUser('rider');
    const b = await makeUser('driver');
    const token = 'ExponentPushToken[test-token]';
    const send = (user, body) => api().post('/api/push-tokens').set(auth(user.token)).send(body);

    const first = await send(a, { token, platform: 'ios' });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.data, { token, platform: 'ios' });
    assert.equal((await send(a, { token, platform: 'android' })).body.data.platform, 'android');
    assert.equal((await send(b, { token, platform: 'android' })).status, 200);

    assert.equal((await send(a, { token, platform: 'windows' })).status, 400);
    assert.equal((await send(a, {})).status, 400);
    assert.equal((await api().post('/api/push-tokens').send({ token, platform: 'ios' })).status, 401);
  });
});
