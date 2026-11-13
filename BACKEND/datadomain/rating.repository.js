const db = require('../wrapper/db');

// ride_id is the primary key, so a second rating raises 23505 (the business layer maps it to 409).
const insert = async ({ rideId, stars, tip, comment }, client) => {
  const { rows } = await (client || db).query(
    `INSERT INTO ratings (ride_id, stars, tip, comment) VALUES ($1, $2, $3, $4) RETURNING *`,
    [rideId, stars, tip, comment || null]
  );
  return rows[0];
};

const findByRideId = async (rideId) => {
  const { rows } = await db.query('SELECT * FROM ratings WHERE ride_id = $1', [rideId]);
  return rows[0] || null;
};

// Average stars over every rated ride this driver completed; average is null until the first rating.
const summaryForDriver = async (driverId) => {
  const { rows } = await db.query(
    `SELECT AVG(rt.stars)::float AS average, COUNT(*)::int AS count
     FROM ratings rt JOIN rides r ON r.id = rt.ride_id
     WHERE r.driver_id = $1`,
    [driverId]
  );
  return rows[0];
};

module.exports = { insert, findByRideId, summaryForDriver };
