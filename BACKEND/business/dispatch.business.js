const rideRepo = require('../datadomain/ride.repository');
const driverLocationBusiness = require('./driver-location.business');
const config = require('../config');

// Dispatch in waves. A new ride request is not shown to every driver at once (that makes drivers far away race the
// nearby ones, and everyone's phone buzz for a ride only one can take). It is shown to the nearest few first:
//
//   age 0-15 s   nearest 3 drivers      age 15-30 s  nearest 6      ...      age 60 s+  every driver in range
//
// "Nearest" means nearest to the PICKUP among online drivers of the right vehicle type, not counting drivers who
// already declined this ride or are busy on another one. If anything is uncertain (a driver is not in the nearby
// list, Redis and the database both fail), the ride is shown: a rider should never wait because dispatch guessed.

const NEARBY_LIMIT = 30;

const allowedCount = (ageSeconds) => {
  if (ageSeconds >= config.dispatchFullAfterSeconds) return Infinity;
  return config.dispatchWaveSize * (1 + Math.floor(ageSeconds / config.dispatchWaveSeconds));
};

// `rows` are ride rows with age_seconds (from listRequestedInBox). Returns the ones this driver should see now.
async function visibleRides(driverId, rows) {
  if (config.dispatchWaveSize <= 0) return rows;
  const checks = await Promise.all(rows.map(async (row) => {
    const allowed = allowedCount(Number(row.age_seconds) || 0);
    if (allowed === Infinity) return true;
    try {
      const nearby = await driverLocationBusiness.findNearbyDrivers({
        lat: row.pickup_lat, lng: row.pickup_lng, vehicleType: row.vehicle_type,
        radiusKm: config.nearbyRadiusKm, limit: NEARBY_LIMIT,
      });
      const ids = nearby.map((d) => d.driverId);
      const unavailable = new Set(await rideRepo.unavailableDriverIds(row.id, ids));
      const line = ids.filter((id) => !unavailable.has(id));
      const rank = line.indexOf(driverId);
      return rank === -1 || rank < allowed;
    } catch {
      return true;
    }
  }));
  return rows.filter((_, i) => checks[i]);
}

module.exports = { visibleRides, allowedCount };
