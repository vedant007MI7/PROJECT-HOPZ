const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const { api, cleanTables, makeUser, auth, closeDb, PICKUP, DROP } = require('./helpers');
const db = require('../wrapper/db');
const mailer = require('../wrapper/mailer');
const sms = require('../wrapper/sms');
const queue = require('../wrapper/queue');
const realtime = require('../wrapper/realtime');
const jobs = require('../business/jobs.business');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

describe('background jobs, queue off (B9)', () => {
  test('the queue is off by default and enqueue says "not queued"', async () => {
    assert.equal(queue.enabled(), false);
    assert.equal(await queue.enqueue('send-reset-code', {}), false);
    assert.equal(await queue.counts(), null);
    assert.equal(queue.startWorker(jobs.handlers), null);
  });

  test('send-reset-code uses email or SMS depending on the channel', async () => {
    const mails = [];
    const texts = [];
    const [m, s] = [mailer.sendResetCode, sms.sendCode];
    mailer.sendResetCode = async (x) => { mails.push(x); };
    sms.sendCode = async (x) => { texts.push(x); };
    try {
      await jobs.handlers['send-reset-code']({ channel: 'email', to: 'a@b.c', name: 'A', code: '111111', minutes: 10 });
      await jobs.handlers['send-reset-code']({ channel: 'sms', to: '+911234567890', code: '222222', minutes: 10 });
    } finally {
      [mailer.sendResetCode, sms.sendCode] = [m, s];
    }
    assert.deepEqual(mails.map((x) => x.code), ['111111']);
    assert.deepEqual(texts.map((x) => x.code), ['222222']);
  });

  test('scheduling a ride expiry does nothing and does not fail when the queue is off', async () => {
    await jobs.scheduleRideExpiry('00000000-0000-0000-0000-000000000000');
  });

  test('the expire-ride job cancels an unanswered ride and tells the rider', async () => {
    const rider = await makeUser('rider');
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    await db.query("UPDATE rides SET requested_at = now() - interval '1 hour' WHERE id = $1", [ride.id]);

    const sent = [];
    const original = realtime.rideChanged;
    realtime.rideChanged = (r) => sent.push(r);
    try {
      await jobs.handlers['expire-ride']({ rideId: ride.id });
    } finally {
      realtime.rideChanged = original;
    }
    const row = (await db.query('SELECT status, cancelled_by FROM rides WHERE id = $1', [ride.id])).rows[0];
    assert.equal(row.status, 'cancelled');
    assert.equal(row.cancelled_by, 'system');
    const events = await db.query("SELECT actor_id FROM ride_events WHERE ride_id = $1 AND status = 'cancelled'", [ride.id]);
    assert.equal(events.rows.length, 1); // the cancel is logged too
    assert.equal(events.rows[0].actor_id, rider.user.id);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].rider_id, rider.user.id);
  });

  test('the expire-ride job leaves a ride that is still fresh alone', async () => {
    const rider = await makeUser('rider');
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' })).body.data;
    await jobs.handlers['expire-ride']({ rideId: ride.id });
    const row = (await db.query('SELECT status FROM rides WHERE id = $1', [ride.id])).rows[0];
    assert.equal(row.status, 'requested');
  });
});
