const rideRepo = require('../datadomain/ride.repository');
const config = require('../config');
const logger = require('../wrapper/logger');

// Lazy expiry: no timer or cron (a free Render service sleeps anyway). Every code path that reads
// or creates rides calls this first, so a stale request is cancelled before anyone sees it.
async function expireStaleRequests() {
  try {
    // One statement, one round trip: this runs on almost every read, and nearly always finds nothing to do.
    const rows = await rideRepo.expireStaleRequested(config.rideRequestTimeoutSeconds);
    // The rider is recorded as actor (actor_id is NOT NULL); cancelled_by on the ride says 'system'.
    if (rows.length) logger.info({ count: rows.length }, 'Expired unanswered ride requests');
  } catch (err) {
    // Never break the real request because cleanup failed.
    logger.error({ err }, 'expireStaleRequests failed');
  }
}

module.exports = { expireStaleRequests };
