const rideRepo = require('../datadomain/ride.repository');
const eventRepo = require('../datadomain/ride-event.repository');
const db = require('../wrapper/db');
const config = require('../config');
const logger = require('../wrapper/logger');
const { RIDE_STATUS } = require('../function/constants');

// Lazy expiry: no timer or cron (a free Render service sleeps anyway). Every code path that reads
// or creates rides calls this first, so a stale request is cancelled before anyone sees it.
async function expireStaleRequests() {
  try {
    await db.withTransaction(async (client) => {
      const rows = await rideRepo.cancelStaleRequested(config.rideRequestTimeoutSeconds, client);
      for (const row of rows) {
        // The rider is recorded as actor (actor_id is NOT NULL); cancelled_by on the ride says 'system'.
        await eventRepo.insert({ rideId: row.id, status: RIDE_STATUS.CANCELLED, actorId: row.rider_id }, client);
      }
      if (rows.length) logger.info({ count: rows.length }, 'Expired unanswered ride requests');
    });
  } catch (err) {
    // Never break the real request because cleanup failed.
    logger.error({ err }, 'expireStaleRequests failed');
  }
}

module.exports = { expireStaleRequests };
