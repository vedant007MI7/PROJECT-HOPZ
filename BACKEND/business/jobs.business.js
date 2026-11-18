const mailer = require('../wrapper/mailer');
const sms = require('../wrapper/sms');
const rideRepo = require('../datadomain/ride.repository');
const realtime = require('../wrapper/realtime');
const { expireStaleRequests } = require('./expiry.business');
const config = require('../config');
const queue = require('../wrapper/queue');
const logger = require('../wrapper/logger');

// What the background worker can do. Each job is a small plain-data description (so it can sit in Redis), and
// each handler can safely run twice: if a worker dies half way, BullMQ runs the job again.

// Email or SMS with a password-reset code. `channel` says which. Also used inline when the queue is off.
async function sendResetCode({ channel, to, name, code, minutes }) {
  if (channel === 'email') return mailer.sendResetCode({ to, name, code, minutes });
  return sms.sendCode({ to, code, minutes });
}

// Runs a little after a ride request's time is up. Cancels it if nobody accepted (this is the same cleanup that
// runs lazily on every read), then tells the rider's phone so "no drivers found" shows up without waiting for a poll.
async function expireRide({ rideId }) {
  await expireStaleRequests();
  const ride = await rideRepo.findById(rideId);
  if (ride && ride.status === 'cancelled') realtime.rideChanged(ride);
}

// Runs when a dispatch wave widens: tells every driver's phone to look again, so the drivers who can now see the
// ride find out straight away instead of at their next poll. Skipped if the ride is already taken or gone.
async function nudgeDrivers({ rideId }) {
  const ride = await rideRepo.findById(rideId);
  if (ride && ride.status === 'requested') realtime.emitToDrivers('requests:changed');
}

const handlers = { 'send-reset-code': sendResetCode, 'expire-ride': expireRide, 'nudge-drivers': nudgeDrivers };

// Called when a ride is requested: one delayed job per ride, so expiry happens on time without any polling.
// jobId makes it idempotent (queuing the same ride twice keeps one job). Does nothing when the queue is off:
// the lazy expiry covers that case.
async function scheduleRideExpiry(rideId) {
  const delay = (config.rideRequestTimeoutSeconds + 1) * 1000;
  const queued = await queue.enqueue('expire-ride', { rideId }, { delay, jobId: `expire-${rideId}`, attempts: 2 });
  if (!queued && queue.enabled()) {
    logger.warn({ rideId }, 'Ride expiry job not queued; lazy expiry will handle it');
    return;
  }
  // One nudge at each point where the dispatch wave gets wider.
  for (let s = config.dispatchWaveSeconds; s <= config.dispatchFullAfterSeconds; s += config.dispatchWaveSeconds) {
    await queue.enqueue('nudge-drivers', { rideId }, { delay: s * 1000 + 500, jobId: `nudge-${rideId}-${s}`, attempts: 1 });
  }
}

module.exports = { handlers, sendResetCode, scheduleRideExpiry };
