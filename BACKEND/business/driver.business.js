const driverProfileRepo = require('../datadomain/driver-profile.repository');
const rideRepo = require('../datadomain/ride.repository');
const { expireStaleRequests } = require('./expiry.business');
const config = require('../config');
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
  return toDriverProfile(profile);
}

async function listRequests(user) {
  await expireStaleRequests();
  const profile = await driverProfileRepo.findByUserId(user.id);
  // Offline, or no location sent yet: nothing to match against.
  if (!profile || !profile.is_online || profile.lat === null) return [];

  const radius = config.nearbyRadiusKm;
  const dLat = radius / KM_PER_DEGREE;
  // Longitude degrees shrink toward the poles; the floor avoids dividing by ~0.
  const dLng = radius / (KM_PER_DEGREE * Math.max(Math.cos((profile.lat * Math.PI) / 180), 0.01));

  const rows = await rideRepo.listRequestedInBox({
    vehicleType: profile.vehicle_type,
    driverId: user.id,
    minLat: profile.lat - dLat,
    maxLat: profile.lat + dLat,
    minLng: profile.lng - dLng,
    maxLng: profile.lng + dLng,
  });

  return rows
    .map((row) => ({ row, km: haversineKm(profile.lat, profile.lng, row.pickup_lat, row.pickup_lng) }))
    .filter(({ km }) => km <= radius) // the box's corners are farther than the radius
    .sort((a, b) => a.km - b.km)
    .map(({ row, km }) => ({ ...toRide(row, user.id), pickup_distance_km: Math.round(km * 100) / 100 }));
}

async function updateLocation(user, { lat, lng }) {
  const profile = await driverProfileRepo.updateLocation(user.id, lat, lng);
  if (!profile) throw new AppError('Driver profile not found', 404);
  return toDriverProfile(profile);
}

async function getEarnings(user) {
  const rows = await rideRepo.listCompletedThisWeek(user.id, EARNINGS_TIMEZONE);
  const sum = (list) => list.reduce((total, row) => total + row.fare, 0);
  return {
    today: sum(rows.filter((row) => row.is_today)),
    week: sum(rows),
    rides: rows.map((row) => toRide(row, user.id)),
  };
}

module.exports = { setStatus, listRequests, updateLocation, getEarnings };
