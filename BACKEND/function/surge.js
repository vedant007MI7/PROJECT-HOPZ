// Surge pricing: when more riders are waiting than there are drivers nearby, the fare is multiplied.
// Pure maths, no database, so it is easy to test. The multiplier moves in steps of 0.25 and never exceeds `cap`.
//
//   demand = ride requests waiting near the pickup (including the one being made)
//   supply = online drivers near the pickup
function surgeMultiplier({ demand, supply, cap = 2 }) {
  if (!demand || demand <= 0) return 1;
  if (supply <= 0) return cap; // riders waiting and nobody to take them
  const ratio = demand / supply;
  if (ratio <= 1) return 1;
  return Math.min(cap, Math.round(ratio * 4) / 4);
}

module.exports = { surgeMultiplier };
