const redis = require('../wrapper/redis');
const config = require('../config');
const logger = require('../wrapper/logger');

// Where a driver is RIGHT NOW. This changes every few seconds and is useless a minute later, so it lives in Redis
// (in memory, fast) instead of being written to Postgres on every update.
//
//   <prefix>drivers:geo       one geospatial set holding every driver's last point (GEOADD / GEOSEARCH)
//   <prefix>driver:<id>       JSON { lat, lng, type, at } with a short life (default 30 s): the driver's latest
//                             position, and also the proof that the driver is still sending updates
//   <prefix>driver:<id>:saved a marker that lives 60 s: while it exists, the database is not written again
//
// A driver that stops sending (app closed, no signal) vanishes after the short life of their key. Members of a
// set cannot expire one by one, so searches skip drivers without a live key and remove them from the set.
//
// Every function here answers "Redis could not do it" (ok:false, or null) instead of throwing, so callers can
// fall back to the database.

const P = config.redisKeyPrefix;
const GEO = `${P}drivers:geo`;
const key = (id) => `${P}driver:${id}`;
const savedKey = (id) => `${P}driver:${id}:saved`;

let lastWarn = 0;
function warn(err, what) {
  if (Date.now() - lastWarn < 30000) return;
  lastWarn = Date.now();
  logger.warn({ err: err.message }, `Redis could not ${what}; using the database`);
}

// Stores the latest position in ONE round trip (3 commands). `persist` says whether the database should be
// written too: true about once a minute per driver, so a Redis restart loses at most a minute of history.
async function set({ id, lat, lng, type }, { ttl = config.driverLocationTtlSeconds, saveEvery = config.driverLocationSaveSeconds } = {}) {
  try {
    const results = await redis.run((c) => c.pipeline()
      .geoadd(GEO, lng, lat, id)
      .set(key(id), JSON.stringify({ lat, lng, type, at: Date.now() }), 'EX', ttl)
      .set(savedKey(id), '1', 'EX', saveEvery, 'NX')
      .exec());
    for (const [err] of results) if (err) throw err;
    return { ok: true, persist: results[2][1] === 'OK' };
  } catch (err) {
    warn(err, 'save a driver location');
    return { ok: false, persist: true };
  }
}

// The driver's latest live position, or null (not sending, or Redis unavailable).
async function get(id) {
  try {
    const raw = await redis.run((c) => c.get(key(id)));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    warn(err, 'read a driver location');
    return null;
  }
}

async function remove(id) {
  try {
    await redis.run((c) => c.pipeline().zrem(GEO, id).del(key(id)).del(savedKey(id)).exec());
    return true;
  } catch (err) {
    warn(err, 'remove a driver location');
    return false;
  }
}

// Drivers within radiusKm of a point, nearest first: [{ driverId, km, lat, lng, type }].
// Returns null when Redis cannot answer (the caller then asks the database).
async function findNearby({ lat, lng, radiusKm, limit = 10, vehicleType = null }) {
  try {
    // With a vehicle filter some candidates are dropped afterwards, so ask for more than `limit`.
    const count = vehicleType ? limit * 3 : limit;
    const found = await redis.run((c) => c.geosearch(
      GEO, 'FROMLONLAT', lng, lat, 'BYRADIUS', radiusKm, 'km', 'ASC', 'COUNT', count, 'WITHDIST'
    ));
    if (!found.length) return [];

    const raws = await redis.run((c) => c.mget(found.map(([id]) => key(id))));
    const drivers = [];
    const gone = [];
    found.forEach(([id, dist], i) => {
      if (!raws[i]) {
        gone.push(id); // stopped sending: its key has expired
        return;
      }
      const rec = JSON.parse(raws[i]);
      if (vehicleType && rec.type !== vehicleType) return;
      drivers.push({ driverId: id, km: Math.round(Number(dist) * 100) / 100, lat: rec.lat, lng: rec.lng, type: rec.type });
    });
    if (gone.length) redis.run((c) => c.zrem(GEO, ...gone)).catch(() => {}); // tidy up, best effort
    return drivers.slice(0, limit);
  } catch (err) {
    warn(err, 'search for nearby drivers');
    return null;
  }
}

module.exports = { set, get, remove, findNearby };
