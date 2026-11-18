// Load test: how many requests per second can ONE server process handle, and how slow does it get?
//
//   1. In one terminal start the server on your PC:           npm start       (uses your dev database)
//   2. In another:   node scripts/loadtest.js --label pool10  [--c 20] [--d 10] [--url http://localhost:3000]
//   3. Stop the server, start it again with another pool size (PowerShell: $env:PG_POOL_MAX=3; npm start)
//      and run with a new --label to compare.
//
// It signs up two throw-away users (@loadtest.hopz.local), hammers four endpoints with autocannon, writes
// docs/loadtest-<label>.md, and deletes the users. Needs:  npm install -D autocannon
// NEVER point it at a server whose database you care about; it creates users and writes driver locations.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const URL_BASE = arg('url', 'http://localhost:3000');
const LABEL = arg('label', 'run');
const CONNECTIONS = Number(arg('c', 20));
const DURATION = Number(arg('d', 10));
const DOMAIN = '@loadtest.hopz.local';

async function signup(role) {
  const body = {
    name: `Load ${role}`, email: `${role}-${Date.now()}${DOMAIN}`, password: 'password123', role,
    ...(role === 'driver' ? { vehicle_type: 'mini', vehicle_model: 'Swift', plate: 'DL01LOAD' } : {}),
  };
  const res = await fetch(`${URL_BASE}/api/auth/signup`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.status !== 201) throw new Error(`signup failed (${res.status}): ${await res.text()}`);
  return (await res.json()).data.token;
}

async function cleanup() {
  if (!process.env.DATABASE_URL) return;
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const like = `%${DOMAIN}`;
  const ids = '(SELECT id FROM users WHERE email LIKE $1)';
  await db.query(`DELETE FROM idempotency_keys WHERE user_id IN ${ids}`, [like]).catch(() => {});
  await db.query(`DELETE FROM push_tokens WHERE user_id IN ${ids}`, [like]);
  await db.query(`DELETE FROM driver_profiles WHERE user_id IN ${ids}`, [like]);
  await db.query('DELETE FROM users WHERE email LIKE $1', [like]);
  await db.end();
}

async function main() {
  let autocannon;
  try {
    autocannon = require('autocannon');
  } catch {
    console.error('Run:  npm install -D autocannon');
    process.exit(1);
  }
  const health = await fetch(`${URL_BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`No server answering at ${URL_BASE}. Start it with: npm start`);
    process.exit(1);
  }

  const riderToken = await signup('rider');
  const driverToken = await signup('driver');
  const json = { 'content-type': 'application/json' };
  const scenarios = [
    { name: 'GET /health (no database, no Redis)', opts: { url: `${URL_BASE}/api/health` } },
    { name: 'GET /health/db (1 database query)', opts: { url: `${URL_BASE}/api/health/db` } },
    {
      name: 'GET /rides?limit=20 (1-2 database queries, logged in)',
      opts: { url: `${URL_BASE}/api/rides?limit=20`, headers: { authorization: `Bearer ${riderToken}` } },
    },
    {
      name: 'POST /drivers/location (Redis; database about once a minute)',
      opts: {
        url: `${URL_BASE}/api/drivers/location`, method: 'POST',
        headers: { ...json, authorization: `Bearer ${driverToken}` },
        body: JSON.stringify({ lat: 28.63, lng: 77.21 }),
      },
    },
  ];

  const rows = [];
  try {
    for (const s of scenarios) {
      console.log(`running: ${s.name}`);
      const r = await autocannon({ connections: CONNECTIONS, duration: DURATION, ...s.opts });
      rows.push({ name: s.name, rps: r.requests.average, p50: r.latency.p50, p97: r.latency.p97_5, p99: r.latency.p99, bad: r.non2xx + r.errors + r.timeouts, total: r.requests.total });
    }
  } finally {
    await cleanup().catch((e) => console.error('cleanup failed:', e.message));
  }

  let md = `# Load test: ${LABEL}\n\nOne server process, ${CONNECTIONS} concurrent connections, ${DURATION} s per endpoint, target ${URL_BASE}. `
    + `Run ${new Date().toISOString().slice(0, 10)}. Latency in milliseconds.\n\n`
    + '| Endpoint | req/s | p50 | p97.5 | p99 | failed |\n|---|---|---|---|---|---|\n';
  for (const r of rows) md += `| ${r.name} | ${Math.round(r.rps)} | ${r.p50} | ${r.p97} | ${r.p99} | ${r.bad} of ${r.total} |\n`;
  const out = path.join(__dirname, '..', 'docs', `loadtest-${LABEL}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  console.log(`\n${md}\nSaved ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
