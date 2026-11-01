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

// --- Not implemented yet ---

// #16 POST /drivers/status
// setOnline(userId, isOnline, client): UPDATE driver_profiles SET is_online = $2
//   WHERE user_id = $1 RETURNING *.
const setOnline = async () => {
  throw new Error('Not implemented yet');
};

// #18 POST /drivers/location
// updateLocation(userId, lat, lng): UPDATE driver_profiles SET lat = $2, lng = $3,
//   location_updated_at = now() WHERE user_id = $1 RETURNING *.
const updateLocation = async () => {
  throw new Error('Not implemented yet');
};

module.exports = { create, findByUserId, setOnline, updateLocation };
