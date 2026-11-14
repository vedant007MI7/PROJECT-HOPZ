const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, cleanTables, makeUser, closeDb } = require('./helpers');
const db = require('../wrapper/db');
const mailer = require('../wrapper/mailer');
const sms = require('../wrapper/sms');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

// No real emails or texts: every "sent" code is kept here instead.
let mails = [];
let texts = [];
mailer.sendResetCode = async (m) => { mails.push(m); };
sms.sendCode = async (m) => { texts.push(m); };
beforeEach(() => { mails = []; texts = []; });

const forgot = (identifier) => api().post('/api/auth/forgot-password').send({ identifier });
const reset = (identifier, code, new_password = 'brand-new-pass') =>
  api().post('/api/auth/reset-password').send({ identifier, code, new_password });
const login = (identifier, password) => api().post('/api/auth/login').send({ identifier, password });

// A valid, unique Indian mobile number (starts with 9, ten digits).
const randomPhone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

describe('POST /auth/forgot-password', () => {
  test('an email identifier gets the code by email', async () => {
    const u = await makeUser('rider');
    const res = await forgot(u.email);
    assert.equal(res.status, 200);
    assert.equal(mails.length, 1);
    assert.equal(texts.length, 0);
    assert.equal(mails[0].to, u.email);
    assert.match(mails[0].code, /^\d{6}$/);
  });

  test('a phone identifier gets the code by SMS, to the stored +91 number', async () => {
    const phone = randomPhone();
    const u = await makeUser('rider', { phone });
    const res = await forgot(phone);
    assert.equal(res.status, 200);
    assert.equal(texts.length, 1);
    assert.equal(mails.length, 0);
    assert.equal(texts[0].to, `+91${phone}`);
    assert.match(texts[0].code, /^\d{6}$/);
    assert.ok(u.user.id);
  });

  test('answers the same for an unknown email or phone and sends nothing', async () => {
    const known = await makeUser('rider');
    const a = await forgot(known.email);
    mails = [];
    const b = await forgot('nobody@hopz-test.local');
    const c = await forgot(randomPhone());
    assert.equal(b.status, 200);
    assert.deepEqual(b.body, a.body);
    assert.deepEqual(c.body, a.body);
    assert.equal(mails.length + texts.length, 0);
  });

  test('asking again straight away does not send a second code', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    await forgot(u.email);
    assert.equal(mails.length, 1);
  });

  test('stores only a hash of the code', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    const { rows } = await db.query('SELECT code_hash FROM otp_codes WHERE user_id = $1', [u.user.id]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].code_hash, mails[0].code);
  });
});

describe('POST /auth/reset-password', () => {
  test('the SMS code resets the password, using the phone number', async () => {
    const phone = randomPhone();
    const u = await makeUser('rider', { phone });
    await forgot(phone);
    const res = await reset(phone, texts[0].code);
    assert.equal(res.status, 200);
    assert.equal((await login(phone, 'brand-new-pass')).status, 200);
    assert.equal((await login(phone, u.password)).status, 401);
  });

  test('the email code resets the password, using the email', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    assert.equal((await reset(u.email, mails[0].code)).status, 200);
    assert.equal((await login(u.email, 'brand-new-pass')).status, 200);
  });

  test('a code works only once', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    const code = mails[0].code;
    assert.equal((await reset(u.email, code)).status, 200);
    assert.equal((await reset(u.email, code, 'another-new-pass')).status, 400);
  });

  test('a wrong code is refused (400) and the password stays', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    const wrong = mails[0].code === '000000' ? '111111' : '000000';
    assert.equal((await reset(u.email, wrong)).status, 400);
    assert.equal((await login(u.email, u.password)).status, 200);
  });

  test('too many wrong guesses lock the code, even for the right one', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    const right = mails[0].code;
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) assert.equal((await reset(u.email, wrong)).status, 400);
    assert.equal((await reset(u.email, right)).status, 400);
  });

  test('an expired code is refused (400)', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    await db.query("UPDATE otp_codes SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [u.user.id]);
    assert.equal((await reset(u.email, mails[0].code)).status, 400);
  });

  test('an unknown account gets the same 400 as a bad code', async () => {
    assert.equal((await reset('nobody@hopz-test.local', '123456')).status, 400);
    assert.equal((await reset(randomPhone(), '123456')).status, 400);
  });

  test('a short new password or a non-numeric code is rejected (400)', async () => {
    const u = await makeUser('rider');
    await forgot(u.email);
    assert.equal((await reset(u.email, mails[0].code, 'short')).status, 400);
    assert.equal((await reset(u.email, 'abcdef')).status, 400);
  });
});
