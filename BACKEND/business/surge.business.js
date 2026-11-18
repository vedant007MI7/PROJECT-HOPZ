const rideRepo = require('../datadomain/ride.repository');
const driverLocationBusiness = require('./driver-location.business');
const config = require('../config');
const { surgeMultiplier } = require('../function/surge');

const KM_PER_DEGREE = 111;

// The multiplier for a ride about to be requested at this pickup. 1 when surge is off (the default).
async function forPickup({ lat, lng, vehicleType }) {
  if (!config.surgeEnabled) return 1;
  const radius = config.surgeRadiusKm;
  const dLat = radius / KM_PER_DEGREE;
  const dLng = radius / (KM_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const [waiting, drivers] = await Promise.all([
    rideRepo.countRequestedInBox({ vehicleType, minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng }),
    driverLocationBusiness.findNearbyDrivers({ lat, lng, vehicleType, radiusKm: radius, limit: 50 }),
  ]);
  return surgeMultiplier({ demand: waiting + 1, supply: drivers.length, cap: config.surgeMaxMultiplier });
}

module.exports = { forPickup };
