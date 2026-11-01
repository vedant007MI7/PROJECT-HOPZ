// All functions below are stubs. Each comment lists the SQL steps to write.
// Every function takes an optional last argument `client` to join a transaction.
const notImplemented = async () => {
  throw new Error('Not implemented yet');
};

// #6 POST /rides
// insert(ride, client): INSERT INTO rides (rider_id, pickup_*, drop_*, vehicle_type,
//   distance_km, fare) VALUES (...) RETURNING *. status defaults to 'requested'.
//   A unique violation (23505 on uq_rides_rider_active) means the rider has an active ride.
const insert = notImplemented;

// #6 pre-check: SELECT 1 FROM rides WHERE rider_id = $1 AND status IN
//   ('requested','accepted','arrived','started') LIMIT 1.
const findActiveByRider = notImplemented;

// #10 pre-check: same, for driver_id with ('accepted','arrived','started').
const findActiveByDriver = notImplemented;

// #7, #9, #11..#15
// findById(id, client): SELECT r.*, plus the driver's name, phone, vehicle_*,
//   plate through LEFT JOIN users/driver_profiles. Add FOR UPDATE when inside a transaction.
const findById = notImplemented;

// #8 GET /rides
// listForUser(userId, role, { status, limit, offset }): WHERE rider_id = $1 (rider) or
//   driver_id = $1 (driver), optional AND status = $2, ORDER BY requested_at DESC LIMIT/OFFSET.
const listForUser = notImplemented;

// #10 POST /rides/:id/accept
// acceptIfRequested(id, driverId, pin, client): the one atomic UPDATE:
//   UPDATE rides SET driver_id = $2, status = 'accepted', start_pin = $3, accepted_at = now()
//   WHERE id = $1 AND status = 'requested' RETURNING *.
//   Zero rows = someone else won (409). Unique violation on uq_rides_driver_active = 409.
const acceptIfRequested = notImplemented;

// #9, #12, #13, #14 (used by the one status-change function)
// updateStatus(id, status, extra, client): UPDATE rides SET status = $2, <timestamp column
//   for that status> = now() [, cancelled_by = $3] WHERE id = $1 RETURNING *.
const updateStatus = notImplemented;

// #13 POST /rides/:id/start
// incrementPinAttempts(id, client): UPDATE rides SET pin_attempts = pin_attempts + 1
//   WHERE id = $1 RETURNING pin_attempts.
const incrementPinAttempts = notImplemented;

// #17 GET /drivers/requests
// listNearbyRequests({ lat, lng, vehicleType, driverId, radiusKm }): status = 'requested',
//   vehicle_type = $, NOT EXISTS ride_events (ride_id = rides.id AND actor_id = driver
//   AND status = 'declined'). Cheap bounding box in SQL, then exact haversine in business.
const listNearbyRequests = notImplemented;

// #19 GET /drivers/earnings
// listCompletedByDriver(driverId, sinceDate): completed rides for the driver with
//   completed_at >= $2, newest first. Business sums today and this week.
const listCompletedByDriver = notImplemented;

module.exports = {
  insert,
  findActiveByRider,
  findActiveByDriver,
  findById,
  listForUser,
  acceptIfRequested,
  updateStatus,
  incrementPinAttempts,
  listNearbyRequests,
  listCompletedByDriver,
};
