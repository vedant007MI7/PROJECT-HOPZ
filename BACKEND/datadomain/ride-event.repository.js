const db = require('../wrapper/db');

// Called inside the same transaction as the change it records.
// Also used for 'declined', which is not a ride status.
const insert = async ({ rideId, status, actorId }, client) => {
  const { rows } = await (client || db).query(
    `INSERT INTO ride_events (ride_id, status, actor_id) VALUES ($1, $2, $3) RETURNING *`,
    [rideId, status, actorId]
  );
  return rows[0];
};

module.exports = { insert };
