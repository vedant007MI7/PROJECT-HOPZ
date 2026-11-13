// Destination search through Ola Maps (free tier). Keep every provider detail in this file,
// so switching to another provider later means changing only this file.
const KEY = process.env.EXPO_PUBLIC_OLA_MAPS_KEY;
const BASE = 'https://api.olamaps.io/places/v1';

export const searchEnabled = !!KEY;

async function getJson(path, params) {
  const url = `${BASE}${path}?${new URLSearchParams({ ...params, api_key: KEY }).toString()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'X-Request-Id': String(Date.now()) } });
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Suggestions for what the rider has typed. `near` ({lat, lng}) biases results toward the rider.
// Returns [{ id, name, sub, lat?, lng? }]; coordinates may need placeCoords() when missing.
export async function searchPlaces(input, near) {
  const params = { input };
  if (near) params.location = `${near.lat},${near.lng}`;
  const data = await getJson('/autocomplete', params);
  return (data.predictions || []).slice(0, 6).map((p) => {
    const parts = String(p.description || '').split(',');
    const main = p.structured_formatting?.main_text || parts[0] || 'Place';
    const sub = p.structured_formatting?.secondary_text || parts.slice(1).join(',').trim();
    const loc = p.geometry?.location;
    return { id: p.place_id, name: main.trim(), sub, lat: loc?.lat, lng: loc?.lng };
  });
}

// Exact coordinates of one suggestion.
export async function placeCoords(placeId) {
  const data = await getJson('/details', { place_id: placeId });
  const loc = data.result?.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') throw new Error('Could not find that place');
  return { lat: loc.lat, lng: loc.lng };
}
