// Fills the TEST database with a lot of fake data so query speed can be measured (B2).
//   node scripts/bench-seed.js --test                      seed (150,000 rides by default)
//   node scripts/bench-seed.js --test --rides=300000       a different size
//   node scripts/bench-seed.js --test --clean              remove everything this script created
// Never touches DATABASE_URL: it only runs against TEST_DATABASE_URL, and every row it creates uses
// an email ending in @bench.hopz.local, so it can be removed again without touching real data.
require('dotenv').config();
const { Pool } = require('pg');

const args = process.argv.slice(2);
const num = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? parseInt(hit.split('=')[1], 10) : fallback;
};

if (!args.includes('--test')) {
  console.error('Add --test: this script only runs against TEST_DATABASE_URL.');
  process.exit(1);
}
if (!process.env.TEST_DATABASE_URL) {
  console.error('Set TEST_DATABASE_URL in .env first.');
  process.exit(1);
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL is the same as DATABASE_URL. Refusing to seed it.');
  process.exit(1);
}

const RIDERS = num('riders', 20000);
const DRIVERS = num('drivers', 2000);
const RIDES = num('rides', 150000);
const OPEN_REQUESTS = 300; // rides waiting for a driver right now
const IN_PROGRESS = 200; // accepted / arrived / started

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
const q = (text, params) => pool.query(text, params);

async function clean() {
  const bench = "(SELECT id FROM users WHERE email LIKE '%@bench.hopz.local')";
  const rides = `(SELECT id FROM rides WHERE rider_id IN ${bench} OR driver_id IN ${bench})`;
  await q(`DELETE FROM ratings WHERE ride_id IN ${rides}`);
  await q(`DELETE FROM payments WHERE ride_id IN ${rides}`);
  await q(`DELETE FROM ride_events WHERE ride_id IN ${rides}`);
  await q(`DELETE FROM rides WHERE rider_id IN ${bench} OR driver_id IN ${bench}`);
  await q(`DELETE FROM driver_profiles WHERE user_id IN ${bench}`);
  await q("DELETE FROM users WHERE email LIKE '%@bench.hopz.local'");
}

async function seed() {
  console.log(`Seeding ${RIDERS} riders, ${DRIVERS} drivers, ${RIDES} past rides...`);

  await q(
    `INSERT INTO users (name, email, password_hash, role)
     SELECT 'Bench rider ' || g, 'rider' || g || '@bench.hopz.local', 'x', 'rider'
     FROM generate_series(1, $1) g`,
    [RIDERS]
  );
  await q(
    `INSERT INTO users (name, email, password_hash, role)
     SELECT 'Bench driver ' || g, 'driver' || g || '@bench.hopz.local', 'x', 'driver'
     FROM generate_series(1, $1) g`,
    [DRIVERS]
  );
  // Drivers are spread around Delhi; about a third are online.
  await q(
    `INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_model, plate, is_online, lat, lng, location_updated_at)
     SELECT id, (ARRAY['auto','mini','sedan'])[1 + floor(random() * 3)::int], 'Bench car', 'DL00BN' || n,
            random() < 0.33, 28.40 + random() * 0.40, 77.00 + random() * 0.40, now()
     FROM (SELECT id, row_number() OVER (ORDER BY email) AS n FROM users WHERE email LIKE 'driver%@bench.hopz.local') d`
  );

  // Numbered copies of the bench users, so a random number picks a random user quickly.
  await q('DROP TABLE IF EXISTS bench_riders');
  await q('DROP TABLE IF EXISTS bench_drivers');
  await q(`CREATE TEMP TABLE bench_riders AS
           SELECT row_number() OVER (ORDER BY email)::int AS n, id FROM users WHERE email LIKE 'rider%@bench.hopz.local'`);
  await q(`CREATE TEMP TABLE bench_drivers AS
           SELECT row_number() OVER (ORDER BY email)::int AS n, id FROM users WHERE email LIKE 'driver%@bench.hopz.local'`);
  await q('CREATE INDEX ON bench_riders (n)');
  await q('CREATE INDEX ON bench_drivers (n)');

  // Past rides over the last year. random()^2 makes some riders very busy (long history), most only a few.
  await q(
    `INSERT INTO rides (rider_id, driver_id, pickup_text, pickup_lat, pickup_lng, drop_text, drop_lat, drop_lng,
                        vehicle_type, distance_km, fare, status, cancelled_by, requested_at, accepted_at, completed_at, cancelled_at)
     SELECT br.id, bd.id, 'Pickup ' || x.g, x.plat, x.plng, 'Drop ' || x.g, x.plat + 0.05, x.plng + 0.05,
            (ARRAY['auto','mini','sedan'])[1 + floor(random() * 3)::int], x.km, (30 + x.km * 12)::int,
            CASE WHEN x.done THEN 'completed' ELSE 'cancelled' END,
            CASE WHEN x.done THEN NULL ELSE 'rider' END,
            x.at, x.at + interval '2 minutes',
            CASE WHEN x.done THEN x.at + interval '30 minutes' END,
            CASE WHEN x.done THEN NULL ELSE x.at + interval '3 minutes' END
     FROM (
       SELECT g,
              1 + floor(power(random(), 2) * $2)::int AS rn,
              1 + floor(random() * $3)::int AS dn,
              28.40 + random() * 0.40 AS plat,
              77.00 + random() * 0.40 AS plng,
              round((1 + random() * 20)::numeric, 2) AS km,
              random() < 0.85 AS done,
              now() - random() * interval '365 days' AS at
       FROM generate_series(1, $1) g
     ) x
     JOIN bench_riders br ON br.n = x.rn
     JOIN bench_drivers bd ON bd.n = x.dn`,
    [RIDES, RIDERS, DRIVERS]
  );

  // Rides waiting for a driver (each from its own rider, fresh enough not to be expired).
  await q(
    `INSERT INTO rides (rider_id, pickup_text, pickup_lat, pickup_lng, drop_text, drop_lat, drop_lng,
                        vehicle_type, distance_km, fare, status, requested_at)
     SELECT br.id, 'Open ' || br.n, 28.40 + random() * 0.40, 77.00 + random() * 0.40, 'Drop', 28.60, 77.20,
            (ARRAY['auto','mini','sedan'])[1 + floor(random() * 3)::int], 5, 90, 'requested',
            now() - random() * interval '100 seconds'
     FROM bench_riders br WHERE br.n <= $1`,
    [OPEN_REQUESTS]
  );
  // Rides in progress: one driver and one rider each.
  await q(
    `INSERT INTO rides (rider_id, driver_id, pickup_text, pickup_lat, pickup_lng, drop_text, drop_lat, drop_lng,
                        vehicle_type, distance_km, fare, status, start_pin, requested_at, accepted_at)
     SELECT br.id, bd.id, 'Live ' || br.n, 28.40 + random() * 0.40, 77.00 + random() * 0.40, 'Drop', 28.60, 77.20,
            'mini', 5, 90, (ARRAY['accepted','arrived','started'])[1 + floor(random() * 3)::int], '1234',
            now() - interval '10 minutes', now() - interval '8 minutes'
     FROM bench_riders br JOIN bench_drivers bd ON bd.n = br.n - $1
     WHERE br.n > $1 AND br.n <= $1 + $2`,
    [OPEN_REQUESTS, IN_PROGRESS]
  );
  // Some drivers have already declined some of the open requests.
  await q(
    `INSERT INTO ride_events (ride_id, status, actor_id)
     SELECT r.id, 'declined', bd.id
     FROM rides r
     JOIN bench_drivers bd ON bd.n = 1 + floor(random() * $1)::int
     WHERE r.status = 'requested' AND r.pickup_text LIKE 'Open %'`,
    [DRIVERS]
  );

  await q('ANALYZE');
  const { rows } = await q(
    `SELECT (SELECT count(*) FROM rides) AS rides, (SELECT count(*) FROM users) AS users,
            pg_size_pretty(pg_database_size(current_database())) AS db_size`
  );
  console.log('Done.', rows[0]);
}

(args.includes('--clean') ? clean().then(() => q('ANALYZE')).then(() => console.log('Bench data removed.')) : seed())
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
