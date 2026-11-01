// Called inside the same transaction as the change it records.
// insert({ rideId, status, actorId }, client): INSERT INTO ride_events (ride_id, status,
//   actor_id) VALUES ($1,$2,$3) RETURNING *. Also used for 'declined' (#11).
const insert = async () => {
  throw new Error('Not implemented yet');
};

module.exports = { insert };
