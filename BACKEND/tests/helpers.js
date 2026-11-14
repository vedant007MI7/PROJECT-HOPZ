// Must run before config is loaded.
process.env.NODE_ENV = 'test';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const app = require('../app');
const db = require('../wrapper/db');

// Only rows with this email domain are ever deleted, so a shared dev database stays safe.
const TEST_DOMAIN = '@hopz-test.local';

const api = () => request(app);

async function cleanTables() {
  const like = `%${TEST_DOMAIN}`;
  const ids = '(SELECT id FROM users WHERE email LIKE $1)';
  const rides = `(SELECT id FROM rides WHERE rider_id IN ${ids} OR driver_id IN ${ids})`;
  await db.query(`DELETE FROM ride_events WHERE ride_id IN ${rides} OR actor_id IN ${ids}`, [like]);
  await db.query(`DELETE FROM payments WHERE ride_id IN ${rides}`, [like]);
  await db.query(`DELETE FROM ratings WHERE ride_id IN ${rides}`, [like]);
  await db.query(`DELETE FROM rides WHERE rider_id IN ${ids} OR driver_id IN ${ids}`, [like]);
  await db.query(`DELETE FROM push_tokens WHERE user_id IN ${ids}`, [like]);
  await db.query(`DELETE FROM driver_profiles WHERE user_id IN ${ids}`, [like]);
  await db.query('DELETE FROM users WHERE email LIKE $1', [like]);
}

let counter = 0;

// Signs up through the real API and returns { user, token }.
async function makeUser(role = 'rider', overrides = {}) {
  counter += 1;
  const body = {
    name: `Test ${role} ${counter}`,
    email: `${role}${counter}-${Date.now()}${TEST_DOMAIN}`,
    password: 'password123',
    role,
    ...(role === 'driver' ? { vehicle_type: 'mini', vehicle_model: 'Swift', plate: 'DL01TEST' } : {}),
    ...overrides,
  };
  const res = await api().post('/api/auth/signup').send(body);
  if (res.status !== 201) throw new Error(`makeUser failed: ${res.status} ${res.text}`);
  return { ...res.body.data, password: body.password, email: body.email };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Test setup shortcut that skips the API: puts a driver online at a spot.
async function setDriverState(userId, { online = true, lat = null, lng = null } = {}) {
  await db.query(
    `UPDATE driver_profiles SET is_online = $2, lat = $3, lng = $4, location_updated_at = now()
     WHERE user_id = $1`,
    [userId, online, lat, lng]
  );
}

// Connaught Place to Noida: about 20 km, so the fare is clearly above the base amount.
const PICKUP = { text: 'Connaught Place', lat: 28.6315, lng: 77.2167 };
const DROP = { text: 'Noida Sector 62', lat: 28.6280, lng: 77.3649 };

const closeDb = () => db.pool.end();

module.exports = {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP, TEST_DOMAIN,
};
