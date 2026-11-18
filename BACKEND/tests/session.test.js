const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it sets NODE_ENV=test before config reads it.
const { api, cleanTables, makeUser, auth, closeDb } = require('./helpers');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../wrapper/db');
const redis = require('../wrapper/redis');
const session = require('../business/session.business');
const { FakeRedis } = require('./fake-redis');

beforeEach(async () => {
  await cleanTables();
  redis.setClientForTests(null);
});
after(async () => {
  redis.setClientForTests(null);
  await cleanTables();
  await closeDb();
});

const me = (token) => api().get('/api/rides').set(auth(token)); // any route that needs a login

describe('revoking logins (B12)', () => {
  test('a normal login works', async () => {
    const u = await makeUser('rider');
    assert.equal((await me(u.token)).status, 200);
  });

  test('a token from before this feature (no tv claim) still works', async () => {
    const u = await makeUser('rider');
    const legacy = jwt.sign({ role: 'rider' }, config.jwtSecret, { subject: u.user.id, expiresIn: '1h' });
    assert.equal((await me(legacy)).status, 200);
  });

  test('a token for a user that no longer exists is refused', async () => {
    const u = await makeUser('rider');
    await db.query('DELETE FROM users WHERE id = $1', [u.user.id]);
    await session.forget(u.user.id);
    assert.equal((await me(u.token)).status, 401);
  });

  test('log out everywhere cancels every earlier token, and a new login works', async () => {
    const u = await makeUser('rider');
    const other = (await api().post('/api/auth/login').send({ identifier: u.email, password: u.password })).body.data.token;
    assert.equal((await me(u.token)).status, 200);
    assert.equal((await me(other)).status, 200);

    const out = await api().post('/api/auth/logout-all').set(auth(u.token));
    assert.equal(out.status, 200);
    assert.equal((await me(u.token)).status, 401);
    assert.equal((await me(other)).status, 401);

    const again = await api().post('/api/auth/login').send({ identifier: u.email, password: u.password });
    assert.equal(again.status, 200);
    assert.equal((await me(again.body.data.token)).status, 200);
  });

  test('changing the password: wrong current password is 400, the right one returns a working new token', async () => {
    const u = await makeUser('rider');
    const wrong = await api().post('/api/auth/change-password').set(auth(u.token))
      .send({ current_password: 'not-it-at-all', new_password: 'newpassword1' });
    assert.equal(wrong.status, 400);
    assert.equal((await me(u.token)).status, 200); // nothing was cancelled

    const res = await api().post('/api/auth/change-password').set(auth(u.token))
      .send({ current_password: u.password, new_password: 'newpassword1' });
    assert.equal(res.status, 200);
    assert.equal((await me(u.token)).status, 401); // the old token is dead
    assert.equal((await me(res.body.data.token)).status, 200); // the new one works

    const login = await api().post('/api/auth/login').send({ identifier: u.email, password: 'newpassword1' });
    assert.equal(login.status, 200);
    const oldLogin = await api().post('/api/auth/login').send({ identifier: u.email, password: u.password });
    assert.equal(oldLogin.status, 401);
  });

  test('change-password validates its input and needs a login', async () => {
    const u = await makeUser('rider');
    const short = await api().post('/api/auth/change-password').set(auth(u.token))
      .send({ current_password: u.password, new_password: 'short' });
    assert.equal(short.status, 400);
    const anon = await api().post('/api/auth/change-password').send({ current_password: 'x', new_password: 'newpassword1' });
    assert.equal(anon.status, 401);
  });

  test('the version is cached, and a change takes effect at once on this instance (with Redis too)', async () => {
    const fake = new FakeRedis();
    redis.setClientForTests(fake);
    const u = await makeUser('rider');
    assert.equal((await me(u.token)).status, 200);
    const keys = [...fake.kv.keys()].filter((k) => k.includes('cache:tv:'));
    assert.equal(keys.length, 1); // the version is now cached in Redis

    await api().post('/api/auth/logout-all').set(auth(u.token));
    assert.equal(fake.kv.has(keys[0]), false); // the cached copy was deleted on the change
    assert.equal((await me(u.token)).status, 401);
  });

  test('the cached version means an authenticated request costs no extra query', async () => {
    const u = await makeUser('rider');
    await me(u.token); // loads the version
    let queries = 0;
    const original = db.query;
    db.query = (...a) => { if (/token_version/.test(a[0])) queries += 1; return original(...a); };
    try {
      await me(u.token);
      await me(u.token);
    } finally {
      db.query = original;
    }
    assert.equal(queries, 0);
  });
});
