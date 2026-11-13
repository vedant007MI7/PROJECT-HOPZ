const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Straight-line distance; good enough for fares and "nearby" checks.
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

module.exports = { haversineKm };
