// B5 benchmark: "which online drivers are near this point?" and "save a driver's new position",
// answered by Postgres vs Redis, with 1,000 and 5,000 simulated drivers.
//
//   node scripts/bench-redis.js          (needs TEST_DATABASE_URL and REDIS_URL in .env)
//
// Postgres side: a TEMP table (vanishes when the script ends, touches no real data) with the same columns and
// the same box query the app uses as its fallback. Redis side: keys under "hopz:bench:" (deleted at the end).
// Uses about 25,000 Redis commands in total (Upstash free tier: 500,000 per month).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Redis = require('ioredis');

if (!process.env.TEST_DATABASE_URL || !process.env.REDIS_URL) {
  console.error('Set TEST_DATABASE_URL and REDIS_URL in .env first.');
  process.exit(1);
}

const SIZES = [1000, 5000];
const SEARCHES = 200;
const UPDATES = 300;
const RADIUS_KM = 5;
const KM_DEG = 111;
const GEO = 'hopz:bench:geo';
// Drivers are spread over a ~20 km square around Connaught Place, Delhi.
const CENTER = { lat: 28.6315, lng: 77.2167 };
const rnd = (c, spread) => c + (Math.random() - 0.5) * spread;

const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((arr.length * p) / 100))];
const stats = (arr) => ({ p50: pct(arr, 50), p95: pct(arr, 95), avg: arr.reduce((a, b) => a + b, 0) / arr.length });
const fmt = (n) => n.toFixed(2);

async function time(n, fn) {
  const t = [];
  for (let i = 0; i < n; i += 1) {
    const s = process.hrtime.bigint();
    await fn(i);
    t.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  return stats(t);
}

async function main() {
  const pg = new Client({ connectionString: process.env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const redis = new Redis(process.env.REDIS_URL);
  const rows = [];

  try {
    await pg.query(`CREATE TEMP TABLE bench_drivers (
      id int PRIMARY KEY, is_online boolean, vehicle_type text, lat double precision, lng double precision,
      location_updated_at timestamptz DEFAULT now())`);
    await pg.query('CREATE INDEX ON bench_drivers (is_online, lat, lng)');

    for (const n of SIZES) {
      await pg.query('TRUNCATE bench_drivers');
      await redis.unlink(GEO);
      await pg.query(
        `INSERT INTO bench_drivers (id, is_online, vehicle_type, lat, lng)
         SELECT g, true, 'mini', $2 + (random() - 0.5) * 0.18, $3 + (random() - 0.5) * 0.18 FROM generate_series(1, $1) g`,
        [n, CENTER.lat, CENTER.lng]
      );
      await pg.query('ANALYZE bench_drivers');
      const pts = (await pg.query('SELECT id, lat, lng FROM bench_drivers')).rows;
      // Load Redis in batches of 500 drivers (1,500 commands per round trip).
      for (let i = 0; i < pts.length; i += 500) {
        const p = redis.pipeline();
        pts.slice(i, i + 500).forEach((d) => {
          p.geoadd(GEO, d.lng, d.lat, String(d.id));
          p.set(`hopz:bench:d:${d.id}`, JSON.stringify({ lat: d.lat, lng: d.lng, type: 'mini' }), 'EX', 600);
        });
        await p.exec();
      }

      const dLat = RADIUS_KM / KM_DEG;
      const dLng = RADIUS_KM / (KM_DEG * Math.cos((CENTER.lat * Math.PI) / 180));
      const spot = () => ({ lat: rnd(CENTER.lat, 0.1), lng: rnd(CENTER.lng, 0.1) });

      const sqlSearch = await time(SEARCHES, async () => {
        const s = spot();
        await pg.query(
          `SELECT id, lat, lng FROM bench_drivers
           WHERE is_online AND lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4
             AND location_updated_at > now() - interval '90 seconds'`,
          [s.lat - dLat, s.lat + dLat, s.lng - dLng, s.lng + dLng]
        );
      });
      const redisSearch = await time(SEARCHES, async () => {
        const s = spot();
        const found = await redis.geosearch(GEO, 'FROMLONLAT', s.lng, s.lat, 'BYRADIUS', RADIUS_KM, 'km', 'ASC', 'COUNT', 10, 'WITHDIST');
        if (found.length) await redis.mget(found.map(([id]) => `hopz:bench:d:${id}`));
      });
      const sqlUpdate = await time(UPDATES, (i) =>
        pg.query('UPDATE bench_drivers SET lat = $2, lng = $3, location_updated_at = now() WHERE id = $1',
          [1 + (i % n), rnd(CENTER.lat, 0.1), rnd(CENTER.lng, 0.1)]));
      const redisUpdate = await time(UPDATES, (i) => {
        const id = 1 + (i % n);
        const lat = rnd(CENTER.lat, 0.1);
        const lng = rnd(CENTER.lng, 0.1);
        return redis.pipeline()
          .geoadd(GEO, lng, lat, String(id))
          .set(`hopz:bench:d:${id}`, JSON.stringify({ lat, lng, type: 'mini' }), 'EX', 30)
          .set(`hopz:bench:d:${id}:saved`, '1', 'EX', 60, 'NX')
          .exec();
      });
      rows.push({ n, sqlSearch, redisSearch, sqlUpdate, redisUpdate });
      console.log(`done ${n} drivers`);
    }
  } finally {
    // Remove every bench key (SCAN, not KEYS, so it is safe on a shared server).
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'hopz:bench:*', 'COUNT', 500);
      cursor = next;
      if (keys.length) await redis.unlink(...keys);
    } while (cursor !== '0');
    await redis.quit();
    await pg.end();
  }

  const line = (label, a, b) => `| ${label} | ${fmt(a.p50)} / ${fmt(a.p95)} | ${fmt(b.p50)} / ${fmt(b.p95)} |`;
  let md = `# B5 benchmark: Postgres vs Redis (driver locations)\n\nRun on ${new Date().toISOString().slice(0, 10)}. `
    + `Each number is milliseconds, p50 / p95, measured from this PC (so it includes the network round trip to Neon / Upstash).\n`
    + `Search = drivers within ${RADIUS_KM} km. Update = save one driver's new position. ${SEARCHES} searches and ${UPDATES} updates per size.\n`;
  for (const r of rows) {
    md += `\n## ${r.n} online drivers\n\n| Operation | Postgres | Redis |\n|---|---|---|\n`
      + `${line('Nearby search', r.sqlSearch, r.redisSearch)}\n${line('Position update', r.sqlUpdate, r.redisUpdate)}\n`;
  }
  md += '\nNote: Redis answers searches from a geospatial index (distance-sorted); the SQL side is a bounding-box scan that '
    + 'still needs the haversine filter and sort in the app. Updates in the real app only hit Postgres about once a minute per driver.\n';
  const out = path.join(__dirname, '..', 'docs', 'bench-redis.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  console.log(md);
  console.log(`Saved ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
