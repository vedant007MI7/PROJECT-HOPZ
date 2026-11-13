// Road route between two points. All routing-provider details live in this file, so switching
// to another provider (for example Ola Maps Directions) means changing only fetchRoute().
// OSRM's public demo server: free, no key, returns the road geometry as GeoJSON.
const BASE = 'https://router.project-osrm.org/route/v1/driving';
const cache = new Map();

const key = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(3)).join(',');

// Returns [{ latitude, longitude }, ...] following the roads, or null if no route could be found.
export async function fetchRoute(a, b) {
  const k = key(a, b);
  if (cache.has(k)) return cache.get(k);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const path = coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    if (cache.size > 50) cache.clear();
    cache.set(k, path);
    return path;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
