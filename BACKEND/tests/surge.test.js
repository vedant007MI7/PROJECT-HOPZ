const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const { api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP } = require('./helpers');
const config = require('../config');
const { surgeMultiplier } = require('../function/surge');
const { calculateFare } = require('../function/fare');
const { haversineKm } = require('../function/geo');

beforeEach(cleanTables);
after(async () => {
  config.surgeEnabled = false;
  await cleanTables();
  await closeDb();
});

describe('surge maths (B10)', () => {
  test('1 when drivers cover the demand, up to the cap when they do not', () => {
    assert.equal(surgeMultiplier({ demand: 1, supply: 3 }), 1);
    assert.equal(surgeMultiplier({ demand: 2, supply: 2 }), 1);
    assert.equal(surgeMultiplier({ demand: 3, supply: 2 }), 1.5);
    assert.equal(surgeMultiplier({ demand: 5, supply: 4 }), 1.25);
    assert.equal(surgeMultiplier({ demand: 10, supply: 2 }), 2);
    assert.equal(surgeMultiplier({ demand: 1, supply: 0 }), 2);
    assert.equal(surgeMultiplier({ demand: 10, supply: 2, cap: 3 }), 3);
    assert.equal(surgeMultiplier({ demand: 0, supply: 0 }), 1);
  });
});

describe('surge on a ride (B10)', () => {
  const request = async (rider) =>
    (await api().post('/api/rides').set(auth(rider.token)).send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
  const baseFare = () => calculateFare('mini', Math.round(haversineKm(PICKUP.lat, PICKUP.lng, DROP.lat, DROP.lng) * 100) / 100);

  test('off by default: the normal fare and surge_multiplier 1', async () => {
    assert.equal(config.surgeEnabled, false);
    const ride = await request(await makeUser('rider'));
    assert.equal(ride.fare, baseFare());
    assert.equal(ride.surge_multiplier, 1);
  });

  test('on, with no drivers nearby: the fare is multiplied by the cap and the ride says so', async () => {
    config.surgeEnabled = true;
    try {
      const ride = await request(await makeUser('rider'));
      assert.equal(ride.surge_multiplier, config.surgeMaxMultiplier);
      assert.equal(ride.fare, Math.round(baseFare() * config.surgeMaxMultiplier));
    } finally {
      config.surgeEnabled = false;
    }
  });

  test('on, with enough drivers nearby: no surge', async () => {
    config.surgeEnabled = true;
    try {
      const driver = await makeUser('driver');
      await setDriverState(driver.user.id, { lat: PICKUP.lat + 0.001, lng: PICKUP.lng });
      const ride = await request(await makeUser('rider'));
      assert.equal(ride.surge_multiplier, 1);
      assert.equal(ride.fare, baseFare());
    } finally {
      config.surgeEnabled = false;
    }
  });
});
