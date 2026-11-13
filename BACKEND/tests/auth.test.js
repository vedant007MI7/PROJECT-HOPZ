const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, cleanTables, makeUser, auth, closeDb, TEST_DOMAIN } = require('./helpers');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

const signupBody = (over = {}) => ({
  name: 'Asha',
  email: `asha${TEST_DOMAIN}`,
  password: 'password123',
  role: 'rider',
  ...over,
});

test('GET /api/health is public', async () => {
  const res = await api().get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, data: { status: 'ok' } });
});

test('GET /api/health/db runs SELECT 1', async () => {
  const res = await api().get('/api/health/db');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.db, 'up');
});

test('signup returns user and token, never the password hash', async () => {
  const res = await api().post('/api/auth/signup').send(signupBody());
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.email, `asha${TEST_DOMAIN}`);
  assert.equal(res.body.data.user.password_hash, undefined);
});

test('signup stores email lower-cased', async () => {
  const res = await api().post('/api/auth/signup').send(signupBody({ email: `ASHA${TEST_DOMAIN}` }));
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, `asha${TEST_DOMAIN}`);
});

test('signup with an existing email is 409', async () => {
  await api().post('/api/auth/signup').send(signupBody());
  const res = await api().post('/api/auth/signup').send(signupBody());
  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
});

test('signup validates input (short password, bad role) with 400', async () => {
  const short = await api().post('/api/auth/signup').send(signupBody({ password: 'short' }));
  assert.equal(short.status, 400);
  const badRole = await api().post('/api/auth/signup').send(signupBody({ role: 'admin' }));
  assert.equal(badRole.status, 400);
});

test('driver signup needs a vehicle type and creates a profile', async () => {
  const missing = await api().post('/api/auth/signup').send(signupBody({ role: 'driver' }));
  assert.equal(missing.status, 400);

  const ok = await api()
    .post('/api/auth/signup')
    .send(signupBody({ role: 'driver', vehicle_type: 'auto' }));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.user.driver_profile.vehicle_type, 'auto');
  assert.equal(ok.body.data.user.driver_profile.is_online, false);
});

test('login works and returns a token', async () => {
  const u = await makeUser('rider');
  const res = await api().post('/api/auth/login').send({ email: u.email, password: u.password });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.id, u.user.id);
});

test('login works with a phone number, in any common format', async () => {
  const u = await makeUser('rider', { phone: '98765 43210' });
  assert.equal(u.user.phone, '+919876543210');
  for (const identifier of ['9876543210', '+91 98765-43210', '919876543210']) {
    const res = await api().post('/api/auth/login').send({ identifier, password: u.password });
    assert.equal(res.status, 200, identifier);
    assert.equal(res.body.data.user.id, u.user.id);
  }
  const wrong = await api().post('/api/auth/login').send({ identifier: '9876543210', password: 'nope-nope-1' });
  const unknown = await api().post('/api/auth/login').send({ identifier: '9123456789', password: 'password123' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error, unknown.body.error);
});

test('login with the identifier field also accepts an email; neither field is 400', async () => {
  const u = await makeUser('rider');
  const res = await api().post('/api/auth/login').send({ identifier: u.email, password: u.password });
  assert.equal(res.status, 200);
  assert.equal((await api().post('/api/auth/login').send({ password: 'x' })).status, 400);
});

test('a phone number is unique across all accounts, in any format', async () => {
  await makeUser('rider', { phone: '9000000001' });
  const dup = await api().post('/api/auth/signup').send(signupBody({ email: `dup${TEST_DOMAIN}`, phone: '+91 90000 00001' }));
  assert.equal(dup.status, 409);
  const asDriver = await api().post('/api/auth/signup').send(signupBody({ email: `drv${TEST_DOMAIN}`, role: 'driver', vehicle_type: 'mini', phone: '9000000001' }));
  assert.equal(asDriver.status, 409);
  const bad = await api().post('/api/auth/signup').send(signupBody({ email: `bad${TEST_DOMAIN}`, phone: '12' }));
  assert.equal(bad.status, 400);
});

test('login gives the same 401 for wrong email and wrong password', async () => {
  const u = await makeUser('rider');
  const wrongPw = await api().post('/api/auth/login').send({ email: u.email, password: 'nope-nope-1' });
  const wrongEmail = await api()
    .post('/api/auth/login')
    .send({ email: `ghost${TEST_DOMAIN}`, password: 'password123' });
  assert.equal(wrongPw.status, 401);
  assert.equal(wrongEmail.status, 401);
  assert.equal(wrongPw.body.error, wrongEmail.body.error);
});

test('GET /api/users/me returns the signed-in user', async () => {
  const u = await makeUser('rider');
  const res = await api().get('/api/users/me').set(auth(u.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, u.user.id);
  assert.equal(res.body.data.driver_profile, undefined);
});

test('GET /api/users/me includes the driver profile for drivers', async () => {
  const d = await makeUser('driver');
  const res = await api().get('/api/users/me').set(auth(d.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.driver_profile.vehicle_type, 'mini');
});

test('GET /api/users/me without or with a bad token is 401', async () => {
  assert.equal((await api().get('/api/users/me')).status, 401);
  const bad = await api().get('/api/users/me').set(auth('not.a.token'));
  assert.equal(bad.status, 401);
});

test('a rider calling a driver-only endpoint gets 403', async () => {
  const rider = await makeUser('rider');
  const res = await api().get('/api/drivers/earnings').set(auth(rider.token));
  assert.equal(res.status, 403);
});

test('unknown route is a 404 in the envelope', async () => {
  const res = await api().get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('malformed JSON is a 400', async () => {
  const res = await api()
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email":');
  assert.equal(res.status, 400);
});
