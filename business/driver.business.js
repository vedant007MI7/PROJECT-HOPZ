const AppError = require('../function/app-error');

const notImplemented = () => {
  throw new AppError('Not implemented yet', 501);
};

// #16 POST /drivers/status (driver)
// 1. If going offline, refuse (409) when the driver has an active ride.
// 2. setOnline(user.id, is_online). Return the driver profile via toDriverProfile.
const setStatus = async (user, input) => notImplemented(user, input);

// #17 GET /drivers/requests (driver)
// 1. Load the profile. If offline or no location yet, return [].
// 2. Query 'requested' rides with the driver's vehicle_type, excluding rides this driver declined.
// 3. Keep rides whose pickup is within NEARBY_RADIUS_KM (haversineKm) of the driver's last
//    location; sort nearest first; map with toRide(row, user.id).
const listRequests = async (user) => notImplemented(user);

// #18 POST /drivers/location (driver)
// 1. updateLocation(user.id, lat, lng). 2. Return the updated profile.
const updateLocation = async (user, input) => notImplemented(user, input);

// #19 GET /drivers/earnings (driver)
// 1. Load the driver's completed rides. 2. Sum fare for completed_at today and in the
//    current week (decide: week starts Monday; use one timezone, e.g. Asia/Kolkata).
// 3. Return { today, week, rides: [...] } with totals in whole rupees.
const getEarnings = async (user) => notImplemented(user);

module.exports = { setStatus, listRequests, updateLocation, getEarnings };
