// Throwaway diagnostic: creates one rider and one ride request on the TEST database and prints the server's real
// error if it fails (the tests hide server logs). Run:  node scripts/debug-ride.js
require('dotenv').config();
if (!process.env.TEST_DATABASE_URL) { console.error('Set TEST_DATABASE_URL in .env'); process.exit(1); }
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'development'; // so the server log prints errors
const request = require('supertest');
const app = require('../app');
const db = require('../wrapper/db');

(async () => {
  const email = `debug-${Date.now()}@hopz-test.local`;
  const s = await request(app).post('/api/auth/signup').send({ name: 'Debug', email, password: 'password123', role: 'rider' });
  console.log('signup', s.status);
  const r = await request(app).post('/api/rides').set('Authorization', `Bearer ${s.body.data.token}`)
    .send({ pickup: { text: 'A', lat: 28.6315, lng: 77.2167 }, drop: { text: 'B', lat: 28.628, lng: 77.3649 }, vehicle_type: 'mini' });
  console.log('ride', r.status, r.text);
  const col = await db.query("select column_name from information_schema.columns where table_name='rides' and column_name='surge_multiplier'");
  console.log('surge_multiplier column present:', col.rows.length === 1);
  await db.query("delete from ride_events where actor_id in (select id from users where email=$1)", [email]);
  await db.query("delete from rides where rider_id in (select id from users where email=$1)", [email]);
  await db.query('delete from users where email=$1', [email]);
  await db.pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
