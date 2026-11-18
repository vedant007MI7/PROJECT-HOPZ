const db = require('../wrapper/db');

const create = async ({ userId, vehicleType, vehicleModel, plate }, client) => {
  const { rows } = await (client || db).query(
    `INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_model, plate)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, vehicleType, vehicleModel || null, plate || null]
  );
  return rows[0];
};

const findByUserId = async (userId, client) => {
  const { rows } = await (client || db).query(
    'SELECT * FROM driver_profiles WHERE user_id = $1',
    [userId]
  );
  return rows[0] || null;
};

const setOnline = async (userId, isOnline) => {
  const { rows } = await db.query(
    'UPDATE driver_profiles SET is_online = $2 WHERE user_id = $1 RETURNING *',
    [userId, isOnline]
  );
  return rows[0] || null;
};

const updateLocation = async (userId, lat, lng) => {
  const { rows } = await db.query(
    `UPDATE driver_profiles SET lat = $2, lng = $3, location_updated_at = now()
     WHERE user_id = $1 RETURNING *`,
    [userId, lat, lng]
  );
  return rows[0] || null;
};

// Online drivers inside a lat/lng box whose last saved position is recent. Used only when Redis cannot answer.
const findOnlineInBox = async ({ vehicleType, minLat, maxLat, minLng, maxLng, freshSeconds }) => {
  const { rows } = await db.query(
    `SELECT user_id, vehicle_type, lat, lng FROM driver_profiles
     WHERE is_online AND ($1::text IS NULL OR vehicle_type = $1)
       AND lat BETWEEN $2 AND $3 AND lng BETWEEN $4 AND $5
       AND location_updated_at > now() - ($6::int * interval '1 second')`,
    [vehicleType || null, minLat, maxLat, minLng, maxLng, freshSeconds]
  );
  return rows;
};

module.exports = { create, findByUserId, setOnline, updateLocation, findOnlineInBox };
