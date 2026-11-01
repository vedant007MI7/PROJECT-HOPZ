const notImplemented = async () => {
  throw new Error('Not implemented yet');
};

// #15 POST /rides/:id/rating
// insert({ rideId, stars, tip, comment }, client): INSERT INTO ratings ... RETURNING *.
//   ride_id is the primary key, so a second rating raises 23505 (map to 409).
const insert = notImplemented;

// findByRideId(rideId): SELECT * FROM ratings WHERE ride_id = $1.
const findByRideId = notImplemented;

// Optional: averageForDriver(driverId): AVG(stars) over ratings joined to rides.
const averageForDriver = notImplemented;

module.exports = { insert, findByRideId, averageForDriver };
