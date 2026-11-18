const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP,
} = require('./helpers');
const http = require('http');
const { io: connect } = require('socket.io-client');
const app = require('../app');
const realtime = require('../wrapper/realtime');
const redis = require('../wrapper/redis');
const { FakeRedis } = require('./fake-redis');

let server;
let url;
const sockets = [];

before(async () => {
  server = http.createServer(app);
  realtime.attach(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await cleanTables();
  redis.setClientForTests(new FakeRedis());
});
after(async () => {
  sockets.forEach((s) => s.disconnect());
  await realtime.stop();
  redis.setClientForTests(null);
  await cleanTables();
  await closeDb();
});

// Connects as a user and records every event it receives.
function listen(token) {
  const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  const got = [];
  ['ride:changed', 'requests:changed', 'driver:location'].forEach((e) => socket.on(e, (p) => got.push({ event: e, ...p })));
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve({ socket, got }));
    socket.on('connect_error', reject);
  });
}

const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  return fn();
};
const quiet = (ms = 400) => new Promise((r) => setTimeout(r, ms));

describe('Socket.IO (B8)', () => {
  test('a bad or missing token is refused', async () => {
    await assert.rejects(listen('nope'), /unauthorized/);
    await assert.rejects(listen(''), /unauthorized/);
  });

  test('a new ride request nudges online drivers, not riders', async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    const other = await makeUser('rider');
    const d = await listen(driver.token);
    const o = await listen(other.token);

    await api().post('/api/rides').set(auth(rider.token)).send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' });
    assert.ok(await until(() => d.got.find((g) => g.event === 'requests:changed')));
    await quiet();
    assert.equal(o.got.length, 0);
  });

  test('ride changes reach the rider and the driver of that ride only', async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    const stranger = await makeUser('rider');
    await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    const r = await listen(rider.token);
    const d = await listen(driver.token);
    const x = await listen(stranger.token);

    await api().post(`/api/rides/${ride.id}/accept`).set(auth(driver.token));
    const seenByRider = await until(() => r.got.find((g) => g.event === 'ride:changed'));
    assert.equal(seenByRider.status, 'accepted');
    assert.equal(seenByRider.ride_id, ride.id);
    assert.ok(await until(() => d.got.find((g) => g.event === 'ride:changed')));
    await quiet();
    assert.equal(x.got.filter((g) => g.event === 'ride:changed').length, 0);
  });

  test('a socket message carries no private data', async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    const r = await listen(rider.token);
    await api().post(`/api/rides/${ride.id}/accept`).set(auth(driver.token));
    const msg = await until(() => r.got.find((g) => g.event === 'ride:changed'));
    assert.deepEqual(Object.keys(msg).sort(), ['event', 'ride_id', 'status']);
  });

  test("the rider is sent the driver's position during the ride, and only then", async () => {
    const rider = await makeUser('rider');
    const driver = await makeUser('driver');
    await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    const r = await listen(rider.token);
    const send = (lat) => api().post('/api/drivers/location').set(auth(driver.token)).send({ lat, lng: 77.22 });

    await send(28.6);
    await quiet();
    assert.equal(r.got.filter((g) => g.event === 'driver:location').length, 0); // not accepted yet

    await api().post(`/api/rides/${ride.id}/accept`).set(auth(driver.token));
    await send(28.61);
    const loc = await until(() => r.got.find((g) => g.event === 'driver:location'));
    assert.equal(loc.lat, 28.61);
    assert.equal(loc.ride_id, ride.id);
  });
});
