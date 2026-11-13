const db = require('../wrapper/db');

// Ride plus the driver's public details. Static text only, no user input.
const RIDE_SELECT = `
  SELECT r.*,
         u.name           AS driver_name,
         u.phone          AS driver_phone,
         dp.vehicle_type  AS driver_vehicle_type,
         dp.vehicle_model AS driver_vehicle_model,
         dp.plate         AS driver_plate,
         ru.name          AS rider_name,
         ru.phone         AS rider_phone
  FROM rides r
  LEFT JOIN users ru           ON ru.id = r.rider_id
  LEFT JOIN users u            ON u.id = r.driver_id
  LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id`;

// Column set by each status change. A whitelist, so nothing user-supplied reaches the SQL text.
const STATUS_TIMESTAMP = {
  accepted: 'accepted_at',
  arrived: 'arrived_at',
  started: 'started_at',
  completed: 'completed_at',
  cancelled: 'cancelled_at',
};

const run = (client) => client || db;

const insert = async (r, client) => {
  const { rows } = await run(client).query(
    `INSERT INTO rides (rider_id, pickup_text, pickup_lat, pickup_lng,
                        drop_text, drop_lat, drop_lng, vehicle_type, distance_km, fare)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [r.riderId, r.pickup.text, r.pickup.lat, r.pickup.lng, r.drop.text, r.drop.lat, r.drop.lng,
      r.vehicleType, r.distanceKm, r.fare]
  );
  return rows[0];
};

const findActiveByRider = async (riderId, client) => {
  const { rows } = await run(client).query(
    `SELECT id FROM rides
     WHERE rider_id = $1 AND status IN ('requested', 'accepted', 'arrived', 'started') LIMIT 1`,
    [riderId]
  );
  return rows[0] || null;
};

const findActiveByDriver = async (driverId, client) => {
  const { rows } = await run(client).query(
    `SELECT id FROM rides
     WHERE driver_id = $1 AND status IN ('accepted', 'arrived', 'started') LIMIT 1`,
    [driverId]
  );
  return rows[0] || null;
};

// forUpdate locks only the ride row (OF r), so concurrent status changes queue up.
const findById = async (id, client, forUpdate = false) => {
  const { rows } = await run(client).query(
    `${RIDE_SELECT} WHERE r.id = $1 ${forUpdate ? 'FOR UPDATE OF r' : ''}`,
    [id]
  );
  return rows[0] || null;
};

const listForUser = async (userId, role, { status, limit, offset }) => {
  const column = role === 'driver' ? 'r.driver_id' : 'r.rider_id';
  const { rows } = await db.query(
    `${RIDE_SELECT}
     WHERE ${column} = $1 AND ($2::text IS NULL OR r.status = $2)
     ORDER BY r.requested_at DESC, r.id
     LIMIT $3 OFFSET $4`,
    [userId, status || null, limit, offset]
  );
  return rows;
};

// The atomic step: only one concurrent caller can flip 'requested' to 'accepted'.
const acceptIfRequested = async (id, driverId, pin, client) => {
  const { rows } = await run(client).query(
    `UPDATE rides
     SET driver_id = $2, status = 'accepted', start_pin = $3, accepted_at = now()
     WHERE id = $1 AND status = 'requested'
     RETURNING *`,
    [id, driverId, pin]
  );
  return rows[0] || null;
};

const updateStatus = async (id, status, { cancelledBy } = {}, client) => {
  const column = STATUS_TIMESTAMP[status];
  if (!column) throw new Error(`No timestamp column for status: ${status}`);
  const { rows } = await run(client).query(
    `UPDATE rides
     SET status = $2, ${column} = now(), cancelled_by = COALESCE($3, cancelled_by)
     WHERE id = $1
     RETURNING *`,
    [id, status, cancelledBy || null]
  );
  return rows[0];
};

const incrementPinAttempts = async (id, client) => {
  const { rows } = await run(client).query(
    'UPDATE rides SET pin_attempts = pin_attempts + 1 WHERE id = $1 RETURNING pin_attempts',
    [id]
  );
  return rows[0].pin_attempts;
};

// Cheap bounding-box filter; the exact distance is checked in the business layer.
const listRequestedInBox = async ({ vehicleType, driverId, minLat, maxLat, minLng, maxLng }) => {
  const { rows } = await db.query(
    `${RIDE_SELECT}
     WHERE r.status = 'requested'
       AND r.vehicle_type = $1
       AND r.pickup_lat BETWEEN $2 AND $3
       AND r.pickup_lng BETWEEN $4 AND $5
       AND NOT EXISTS (
         SELECT 1 FROM ride_events e
         WHERE e.ride_id = r.id AND e.actor_id = $6 AND e.status = 'declined')
     ORDER BY r.requested_at
     LIMIT 50`,
    [vehicleType, minLat, maxLat, minLng, maxLng, driverId]
  );
  return rows;
};

// This week's completed rides (week starts Monday in `timezone`), flagged if completed today.
const listCompletedThisWeek = async (driverId, timezone) => {
  const { rows } = await db.query(
    `SELECT r.*,
            (r.completed_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2) AS is_today
     FROM rides r
     WHERE r.driver_id = $1 AND r.status = 'completed'
       AND r.completed_at >= date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2
     ORDER BY r.completed_at DESC`,
    [driverId, timezone]
  );
  return rows;
};

// Cancels every 'requested' ride older than `seconds` in one atomic UPDATE.
// Returns the cancelled rows so the caller can log an event for each.
const cancelStaleRequested = async (seconds, client) => {
  const { rows } = await run(client).query(
    `UPDATE rides
     SET status = 'cancelled', cancelled_by = 'system', cancelled_at = now()
     WHERE status = 'requested' AND requested_at < now() - ($1::int * interval '1 second')
     RETURNING id, rider_id`,
    [seconds]
  );
  return rows;
};

module.exports = {
  cancelStaleRequested,
  insert,
  findActiveByRider,
  findActiveByDriver,
  findById,
  listForUser,
  acceptIfRequested,
  updateStatus,
  incrementPinAttempts,
  listRequestedInBox,
  listCompletedThisWeek,
};
