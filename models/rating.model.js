const toRating = (row) => ({
  ride_id: row.ride_id,
  stars: row.stars,
  tip: row.tip,
  comment: row.comment,
  created_at: row.created_at,
});

module.exports = { toRating };
