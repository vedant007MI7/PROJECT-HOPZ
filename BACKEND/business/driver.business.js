const driverProfileRepo = require('../datadomain/driver-profile.repository');
const rideRepo = require('../datadomain/ride.repository');
const { expireStaleRequests } = require('./expiry.business');
const locationBusiness = require('./driver-location.business');
const config = require('../config');
const dispatch = require('./dispatch.business');
const cache = require('../wrapper/cache');
const cacheKeys = require('../function/cache-keys');
const AppError = require('../function/app-error');
const { haversineKm } = require('../function/geo');
const { EARNINGS_TIMEZONE } = require('../function/constants');
const { toDriverProfile } = require('../models/driver-profile.model');
const { toRide } = require('../models/ride.model');

const KM_PER_DEGREE = 111;

async function setStatus(user, { is_online: isOnline }) {
  if (!isOnline && (await rideRepo.findActiveByDriver(user.id))) {
    throw new AppError('Finish or cancel your active ride before going offline', 409);
  }
  const profile = await driverProfileRepo.setOnline(user.id, isOnline);
  if (!profile) throw new AppError('Driver profile not found', 404);
  // Offline drivers must stop appearing in nearby searches at once.
  if (!isOnline) await locationBusiness.goOffline(user.id);
  return toDriverProfile(profile);
}

async function listRequests(user) {
  await expireStaleRequests();
  const profile = await driverProfileRepo.findByUserId(user.id);
  // Offline: nothing to match against.
  if (!profile || !profile.is_online) return [];
  // The newest position is in Redis; the database copy can be a minute old.
  const here = (await locationBusiness.getLiveLocation(user.id)) || { lat: profile.lat, lng: profile.lng };
  // No location sent yet: nothing to match against.
  if (here.lat === null || here.lat === undefined) return [];

  const radius = config.nearbyRadiusKm;
  const dLat = radius / KM_PER_DEGREE;
  // Longitude degrees shrink toward the poles; the floor avoids dividing by ~0.
  const dLng = radius / (KM_PER_DEGREE * Math.max(Math.cos((here.lat * Math.PI) / 180), 0.01));

  const rows = await rideRepo.listRequestedInBox({
    vehicleType: profile.vehicle_type,
    driverId: user.id,
    minLat: here.lat - dLat,
    maxLat: here.lat + dLat,
    minLng: here.lng - dLng,
    maxLng: here.lng + dLng,
  });

  // Dispatch in waves: new requests reach the nearest drivers first (see dispatch.business.js).
  const visible = await dispatch.visibleRides(user.id, rows);

  return visible
    .map((row) => ({ row, km: haversineKm(here.lat, here.lng, row.pickup_lat, row.pickup_lng) }))
    .filter(({ km }) => km <= radius) // the box's corners are farther than the radius
    .sort((a, b) => a.km - b.km)
    .map(({ row, km }) => ({ ...toRide(row, user.id), pickup_distance_km: Math.round(km * 100) / 100 }));
}

// Normally written to Redis only (see driver-location.business.js); the answer is just the point and when it was saved.
async function updateLocation(user, body) {
  return locationBusiness.updateLocation(user, body);
}

// Cached for 60 s per driver (the screen is opened often; the numbers change only when a ride completes, and
// completing a ride deletes the entry, so a driver never sees stale totals after finishing a trip).
const EARNINGS_TTL_SECONDS = 60;

async function getEarnings(user) {
  return cache.getOrSet(cacheKeys.earnings(user.id), EARNINGS_TTL_SECONDS, async () => {
    const rows = await rideRepo.listCompletedThisWeek(user.id, EARNINGS_TIMEZONE);
    const sum = (list) => list.reduce((total, row) => total + row.fare, 0);
    return {
      today: sum(rows.filter((row) => row.is_today)),
      week: sum(rows),
      rides: rows.map((row) => toRide(row, user.id)),
    };
  });
}

module.exports = { setStatus, listRequests, updateLocation, getEarnings };
