// Measures the main queries with EXPLAIN ANALYZE on the TEST database (run bench-seed.js first).
//   node scripts/bench-explain.js before     writes docs/bench-before.md
//   node scripts/bench-explain.js after      writes docs/bench-after.md
// Each query runs once to warm up, then 5 times; the table shows the median. Nothing is changed:
// the one UPDATE is run inside a transaction that is rolled back.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const label = process.argv[2] || 'run';
if (!process.env.TEST_DATABASE_URL) {
  console.error('Set TEST_DATABASE_URL in .env first.');
  process.exit(1);
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL is the same as DATABASE_URL. Refusing to run.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });

// Same text as datadomain/ride.repository.js
const RIDE_SELECT = `
  SELECT r.*,
         u.name           AS driver_name,
         u.phone          AS driver_phone,
         dp.vehicle_type  AS driver_vehicle_type,
         dp.vehicle_model AS driver_vehicle_model,
         dp.plate         AS driver_plate,
         dp.lat           AS driver_lat,
         dp.lng           AS driver_lng,
         ru.name          AS rider_name,
         ru.phone         AS rider_phone
  FROM rides r
  LEFT JOIN users ru           ON ru.id = r.rider_id
  LEFT JOIN users u            ON u.id = r.driver_id
  LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id`;

// Walks the JSON plan and lists each step, e.g. "Index Scan using idx_x on rides".
function steps(node, out = []) {
  let s = node['Node Type'];
  if (node['Index Name']) s += ` using ${node['Index Name']}`;
  if (node['Relation Name']) s += ` on ${node['Relation Name']}`;
  out.push(s);
  (node.Plans || []).forEach((c) => steps(c, out));
  return out;
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function explain(client, sql, params, { rollback = false } = {}) {
  const run = async (format) => {
    if (rollback) await client.query('BEGIN');
    try {
      const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT ${format}) ${sql}`, params);
      return res.rows;
    } finally {
      if (rollback) await client.query('ROLLBACK');
    }
  };
  await run('JSON'); // warm-up
  const times = [];
  let plan;
  for (let i = 0; i < 5; i += 1) {
    const rows = await run('JSON');
    const j = rows[0]['QUERY PLAN'][0];
    times.push(j['Execution Time']);
    plan = j.Plan;
  }
  const text = (await run('TEXT')).map((r) => r['QUERY PLAN']).join('\n');
  const buffers = (plan['Shared Hit Blocks'] || 0) + (plan['Shared Read Blocks'] || 0);
  return { ms: median(times), steps: steps(plan), buffers, text, rows: plan['Actual Rows'] };
}

async function main() {
  const client = await pool.connect();
  const one = async (sql, params) => (await client.query(sql, params)).rows[0];

  const heavyRider = (await one(
    "SELECT rider_id AS id, count(*) FROM rides WHERE pickup_text LIKE 'Pickup %' GROUP BY rider_id ORDER BY count(*) DESC LIMIT 1"
  ));
  const heavyDriver = (await one(
    "SELECT driver_id AS id, count(*) FROM rides WHERE pickup_text LIKE 'Pickup %' GROUP BY driver_id ORDER BY count(*) DESC LIMIT 1"
  ));
  const anyDriver = (await one("SELECT user_id AS id FROM driver_profiles WHERE plate = 'DL00BN7'")) || heavyDriver;
  const cursor = await one(
    `SELECT requested_at, id FROM rides WHERE rider_id = $1
     ORDER BY requested_at DESC, id DESC OFFSET 800 LIMIT 1`,
    [heavyRider.id]
  );
  console.log(`Busiest rider has ${heavyRider.count} rides, busiest driver ${heavyDriver.count}.`);

  const queries = [
    {
      name: 'Driver polls open requests (listRequestedInBox)',
      sql: `${RIDE_SELECT}
        WHERE r.status = 'requested' AND r.vehicle_type = $1
          AND r.pickup_lat BETWEEN $2 AND $3 AND r.pickup_lng BETWEEN $4 AND $5
          AND NOT EXISTS (SELECT 1 FROM ride_events e WHERE e.ride_id = r.id AND e.actor_id = $6 AND e.status = 'declined')
        ORDER BY r.requested_at LIMIT 50`,
      params: ['mini', 28.5, 28.7, 77.1, 77.3, anyDriver.id],
    },
    {
      name: 'Expire stale requests (cancelStaleRequested, rolled back)',
      sql: `UPDATE rides SET status = 'cancelled', cancelled_by = 'system', cancelled_at = now()
        WHERE status = 'requested' AND requested_at < now() - ($1::int * interval '1 second')
        RETURNING id, rider_id`,
      params: [60],
      rollback: true,
    },
    {
      name: 'Rider history, page 1 (OFFSET 0)',
      sql: `${RIDE_SELECT} WHERE r.rider_id = $1 AND ($2::text IS NULL OR r.status = $2)
        ORDER BY r.requested_at DESC, r.id LIMIT 20 OFFSET 0`,
      params: [heavyRider.id, null],
    },
    {
      name: 'Rider history, deep page (OFFSET 800)',
      sql: `${RIDE_SELECT} WHERE r.rider_id = $1 AND ($2::text IS NULL OR r.status = $2)
        ORDER BY r.requested_at DESC, r.id LIMIT 20 OFFSET 800`,
      params: [heavyRider.id, null],
    },
    {
      name: 'Rider history, same page by keyset cursor',
      sql: `${RIDE_SELECT} WHERE r.rider_id = $1 AND (r.requested_at, r.id) < ($2, $3)
        ORDER BY r.requested_at DESC, r.id DESC LIMIT 20`,
      params: [heavyRider.id, cursor.requested_at, cursor.id],
    },
    {
      name: 'Driver history, page 1',
      sql: `${RIDE_SELECT} WHERE r.driver_id = $1 AND ($2::text IS NULL OR r.status = $2)
        ORDER BY r.requested_at DESC, r.id LIMIT 20 OFFSET 0`,
      params: [heavyDriver.id, null],
    },
    {
      name: 'Driver weekly earnings (listCompletedThisWeek)',
      sql: `SELECT r.*, (r.completed_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2) AS is_today
        FROM rides r
        WHERE r.driver_id = $1 AND r.status = 'completed'
          AND r.completed_at >= date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2
        ORDER BY r.completed_at DESC`,
      params: [heavyDriver.id, 'Asia/Kolkata'],
    },
    {
      name: 'Driver average rating (summaryForDriver)',
      sql: `SELECT AVG(rt.stars)::float AS average, COUNT(*)::int AS count
        FROM ratings rt JOIN rides r ON r.id = rt.ride_id WHERE r.driver_id = $1`,
      params: [heavyDriver.id],
    },
    {
      name: 'Rider has an active ride? (findActiveByRider)',
      sql: `SELECT id FROM rides WHERE rider_id = $1 AND status IN ('requested', 'accepted', 'arrived', 'started') LIMIT 1`,
      params: [heavyRider.id],
    },
  ];

  const results = [];
  for (const q of queries) {
    const r = await explain(client, q.sql, q.params, { rollback: q.rollback });
    results.push({ name: q.name, ...r });
    console.log(`${r.ms.toFixed(2).padStart(9)} ms  ${q.name}`);
  }

  let md = `# Query benchmark: ${label}\n\n`;
  md += 'Test database, about 150,000 rides, 22,000 users. Median of 5 runs after a warm-up.\n\n';
  md += '| Query | Median ms | Buffers | Rows | Plan steps |\n| --- | ---: | ---: | ---: | --- |\n';
  for (const r of results) {
    md += `| ${r.name} | ${r.ms.toFixed(2)} | ${r.buffers} | ${r.rows} | ${r.steps.join(' > ')} |\n`;
  }
  md += '\n## Full plans\n';
  for (const r of results) md += `\n### ${r.name}\n\n\`\`\`\n${r.text}\n\`\`\`\n`;

  const file = path.join(__dirname, '..', 'docs', `bench-${label}.md`);
  fs.writeFileSync(file, md);
  console.log(`\nWrote ${file}`);
  client.release();
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
