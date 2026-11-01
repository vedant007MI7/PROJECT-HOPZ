// Rupees. Edit here to change pricing.
const RATES = {
  auto: { base: 30, perKm: 12 },
  mini: { base: 50, perKm: 14 },
  sedan: { base: 80, perKm: 18 },
};

function calculateFare(vehicleType, distanceKm) {
  const rate = RATES[vehicleType];
  if (!rate) throw new Error(`Unknown vehicle type: ${vehicleType}`);
  return Math.round(rate.base + rate.perKm * distanceKm);
}

module.exports = { RATES, calculateFare };
