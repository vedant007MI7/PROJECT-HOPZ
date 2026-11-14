const db = require('../wrapper/db');

// Rides in progress by status. The partial unique index on active rides answers this without reading old rides.
const activeRidesByStatus = async () => {
  const { rows } = await db.query(
    `SELECT status, count(*)::int AS count FROM rides
     WHERE status IN ('requested', 'accepted', 'arrived', 'started') GROUP BY status`
  );
  return rows;
};

const onlineDrivers = async () => {
  const { rows } = await db.query('SELECT count(*)::int AS count FROM driver_profiles WHERE is_online');
  return rows[0].count;
};

module.exports = { activeRidesByStatus, onlineDrivers };
