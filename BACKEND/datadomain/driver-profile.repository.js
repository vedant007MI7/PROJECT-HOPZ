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

module.exports = { create, findByUserId, setOnline, updateLocation };
