// Road route between two points. All routing-provider details live in this file, so switching
// to another provider (for example Ola Maps Directions) means changing only fetchRoute().
// OSRM's public demo server: free, no key, returns the road geometry as GeoJSON.
const BASE = 'https://router.project-osrm.org/route/v1/driving';
const cache = new Map();

// The free OSRM server is sometimes slow or down. After 3 failures in a row, skip it for a minute instead of
// making every screen wait 8 s; the map then shows a straight line between the points, which is still useful.
let failures = 0;
let skipUntil = 0;
function noteFailure() {
  failures += 1;
  if (failures >= 3) {
    skipUntil = Date.now() + 60000;
    failures = 0;
  }
}

const key = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(3)).join(',');

// Returns [{ latitude, longitude }, ...] following the roads, or null if no route could be found.
export async function fetchRoute(a, b) {
  const k = key(a, b);
  if (cache.has(k)) return cache.get(k);
  if (Date.now() < skipUntil) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ctrl.signal });
    if (!res.ok) {
      noteFailure();
      return null;
    }
    const data = await res.json();
    failures = 0;
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const path = coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    if (cache.size > 50) cache.clear();
    cache.set(k, path);
    return path;
  } catch {
    noteFailure();
    return null;
  } finally {
    clearTimeout(timer);
  }
}
