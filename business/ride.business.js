const AppError = require('../function/app-error');

// Every function here is a stub. `user` is { id, role } from the token.
// Shared rule for all ride endpoints: someone else's ride => 404 (not 403), unknown id => 404.
// Shared rule for status changes: ONE function (changeStatus) inside withTransaction that
//   1. locks the ride row (SELECT ... FOR UPDATE),
//   2. checks ALLOWED_MOVES[current] includes the target, else 409,
//   3. updates the ride and sets the matching timestamp,
//   4. inserts the ride_events row (status, actor_id).
// Build changeStatus first (with #9 or #12) and reuse it everywhere.
const notImplemented = () => {
  throw new AppError('Not implemented yet', 501);
};

// #6 POST /rides (rider)
// 1. Reject if the rider already has an active ride (409).
// 2. distance_km = haversineKm(pickup, drop); fare = calculateFare(vehicle_type, distance_km).
//    Never read fare from the client.
// 3. Insert the ride in 'requested' and write a 'requested' ride_event (one transaction).
// 4. Return toRide(row, user.id).
const createRide = async (user, input) => notImplemented(user, input);

// #7 GET /rides/:id (rider or driver of that ride)
// 1. Load ride with driver details; 404 if missing or caller is neither rider nor driver.
//    (A driver who has not accepted yet has no access either.)
// 2. Return toRide(row, user.id): start_pin only for the rider.
const getRide = async (user, rideId) => notImplemented(user, rideId);

// #8 GET /rides (any)
// 1. Query the caller's rides (rider_id for riders, driver_id for drivers).
// 2. Optional status filter, newest first, limit/offset from the validated query.
const listRides = async (user, query) => notImplemented(user, query);

// #9 POST /rides/:id/cancel (rider or driver of the ride)
// 1. 404 if not a participant. 2. Only from requested, accepted, arrived (409 otherwise).
// 3. changeStatus -> 'cancelled', save cancelled_by = caller's role.
const cancelRide = async (user, rideId) => notImplemented(user, rideId);

// #10 POST /rides/:id/accept (driver)
// 1. Driver profile must be online (409 'Go online first') and have no active ride (409).
// 2. Ride must exist (404). Vehicle type match is checked here too.
// 3. In a transaction: generatePin(); acceptIfRequested(...) = one atomic UPDATE with
//    WHERE status = 'requested'. Zero rows => 409 'Ride already taken'. First driver wins.
// 4. Write the 'accepted' ride_event. Return toRide(row, user.id) (driver does not see PIN).
const acceptRide = async (user, rideId) => notImplemented(user, rideId);

// #11 POST /rides/:id/decline (driver)
// 1. Ride must exist and be 'requested' (404 / 409).
// 2. Insert a 'declined' ride_event for this driver. The ride stays open for others.
// 3. Declining twice is fine (idempotent).
const declineRide = async (user, rideId) => notImplemented(user, rideId);

// #12 POST /rides/:id/arrived (the ride's driver)
// 1. 404 if the caller is not this ride's driver. 2. changeStatus accepted -> arrived.
const markArrived = async (user, rideId) => notImplemented(user, rideId);

// #13 POST /rides/:id/start (the ride's driver)
// 1. 404 if not this ride's driver; ride must be 'arrived' (409).
// 2. If pin_attempts >= PIN_MAX_ATTEMPTS => 423 locked.
// 3. Wrong PIN: pin_attempts + 1 (persist it even though we respond with an error),
//    then 400 'Wrong PIN' (423 if that attempt reached the limit).
// 4. Right PIN: changeStatus arrived -> started.
const startRide = async (user, rideId, pin) => notImplemented(user, rideId, pin);

// #14 POST /rides/:id/complete (the ride's driver)
// 1. 404 if not this ride's driver. 2. changeStatus started -> completed.
const completeRide = async (user, rideId) => notImplemented(user, rideId);

// #15 POST /rides/:id/rating (rider of the ride)
// 1. 404 if not the rider. 2. Ride must be 'completed' (409). 3. Only once (409).
// 4. Insert the rating; return toRating(row). Optionally refresh the driver's average.
const rateRide = async (user, rideId, input) => notImplemented(user, rideId, input);

module.exports = {
  createRide,
  getRide,
  listRides,
  cancelRide,
  acceptRide,
  declineRide,
  markArrived,
  startRide,
  completeRide,
  rateRide,
};
