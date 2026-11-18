const locationRepo = require('../datadomain/driver-location.repository');
const driverProfileRepo = require('../datadomain/driver-profile.repository');
const rideRepo = require('../datadomain/ride.repository');
const cache = require('../wrapper/cache');
const realtime = require('../wrapper/realtime');
const config = require('../config');
const AppError = require('../function/app-error');
const { haversineKm } = require('../function/geo');

const KM_PER_DEGREE = 111;
// The database copy can be up to a minute old when Redis was working, so the fallback accepts that much.
const DB_FRESH_SECONDS = 90;

// A driver's vehicle type does not change, so it is remembered here instead of being read from the database on
// every location update. The first update after a restart (or after 10 minutes) reads it once.
const TYPE_TTL_MS = 10 * 60 * 1000;
const types = new Map(); // userId -> { type, until }

function knownType(userId) {
  const hit = types.get(userId);
  if (!hit) return null;
  if (hit.until < Date.now()) {
    types.delete(userId);
    return null;
  }
  return hit.type;
}

function rememberType(userId, type) {
  if (types.size > 10000) types.clear();
  types.set(userId, { type, until: Date.now() + TYPE_TTL_MS });
}

// Called every few seconds by every online driver. Normally this touches only Redis; the database is written
// about once a minute (or on every call if Redis is unavailable, which is how it worked before).
async function updateLocation(user, { lat, lng }) {
  const cached = knownType(user.id);
  let persist = true;
  if (cached) {
    ({ persist } = await locationRepo.set({ id: user.id, lat, lng, type: cached }));
  }

  let savedAt = new Date().toISOString();
  if (persist) {
    const profile = await driverProfileRepo.updateLocation(user.id, lat, lng);
    if (!profile) throw new AppError('Driver profile not found', 404);
    rememberType(user.id, profile.vehicle_type);
    savedAt = profile.location_updated_at;
    // First update since the type was unknown: now it is, so the position can go to Redis too.
    if (!cached) await locationRepo.set({ id: user.id, lat, lng, type: profile.vehicle_type });
  }
  await pushToRider(user.id, lat, lng);
  return { lat, lng, location_updated_at: savedAt };
}

// While a driver has a ride, their rider's map follows them. "Who is my rider?" changes rarely, so it is cached
// for 10 s (and forgotten when the ride changes) instead of being a database query on every update.
const activeRiderKey = (driverId) => `activeRider:${driverId}`;

async function pushToRider(driverId, lat, lng) {
  if (!realtime.enabled()) return;
  try {
    const active = await cache.getOrSet(activeRiderKey(driverId), 10, async () => {
      const ride = await rideRepo.findActiveByDriver(driverId);
      return ride ? { ride_id: ride.id, rider_id: ride.rider_id } : null;
    });
    if (active) realtime.emitToUser(active.rider_id, 'driver:location', { ride_id: active.ride_id, lat, lng });
  } catch {
    // The push is a bonus: the rider's screen also refreshes by itself.
  }
}

async function forgetActiveRider(driverId) {
  if (driverId) await cache.del(activeRiderKey(driverId));
}

// The driver's live position as { lat, lng }, or null when Redis has none (callers use the database copy).
async function getLiveLocation(driverId) {
  const rec = await locationRepo.get(driverId);
  return rec ? { lat: rec.lat, lng: rec.lng } : null;
}

// A driver who goes offline must stop showing up in searches at once, not 30 seconds later.
async function goOffline(driverId) {
  await locationRepo.remove(driverId);
}

// Online drivers within radiusKm of a point, nearest first. Redis answers in under a millisecond of server time;
// if it cannot, the same question is asked of the database.
async function findNearbyDrivers({ lat, lng, vehicleType = null, radiusKm = config.nearbyRadiusKm, limit = 10 }) {
  const fromRedis = await locationRepo.findNearby({ lat, lng, radiusKm, limit, vehicleType });
  if (fromRedis) return fromRedis;

  const dLat = radiusKm / KM_PER_DEGREE;
  const dLng = radiusKm / (KM_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const rows = await driverProfileRepo.findOnlineInBox({
    vehicleType, minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng, freshSeconds: DB_FRESH_SECONDS,
  });
  return rows
    .map((row) => ({
      driverId: row.user_id,
      km: Math.round(haversineKm(lat, lng, row.lat, row.lng) * 100) / 100,
      lat: row.lat,
      lng: row.lng,
      type: row.vehicle_type,
    }))
    .filter((d) => d.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

module.exports = { updateLocation, getLiveLocation, goOffline, findNearbyDrivers, forgetActiveRider };
