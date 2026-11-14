// Set before helpers load, because config reads the environment once.
process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
process.env.RAZORPAY_KEY_SECRET = 'unit-test-secret';

const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  api, cleanTables, makeUser, auth, closeDb, setDriverState, PICKUP, DROP,
} = require('./helpers');
const razorpay = require('../wrapper/razorpay');

beforeEach(cleanTables);
after(async () => {
  await cleanTables();
  await closeDb();
});

// No real calls to Razorpay: a fake order is returned instead.
let orderCounter = 0;
razorpay.createOrder = async ({ amountPaise }) => {
  orderCounter += 1;
  return { id: `order_test_${Date.now()}_${orderCounter}`, amount: amountPaise, currency: 'INR' };
};

const sign = (orderId, paymentId, secret = 'unit-test-secret') =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

const post = (user, path, body) => api().post(`/api/rides/${path}`).set(auth(user.token)).send(body);

// A completed ride; `method` is how the rider chose to pay.
async function completedRide(method = 'online') {
  const rider = await makeUser('rider');
  const driver = await makeUser('driver');
  await setDriverState(driver.user.id, { lat: PICKUP.lat, lng: PICKUP.lng });
  const ride = (await api().post('/api/rides').set(auth(rider.token))
    .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini', payment_method: method })).body.data;
  await post(driver, `${ride.id}/accept`);
  const pin = (await api().get(`/api/rides/${ride.id}`).set(auth(rider.token))).body.data.start_pin;
  await post(driver, `${ride.id}/arrived`);
  await post(driver, `${ride.id}/start`, { pin });
  await post(driver, `${ride.id}/complete`);
  return { rider, driver, ride };
}

describe('payment method on a ride', () => {
  test('defaults to cash and unpaid', async () => {
    const rider = await makeUser('rider');
    const res = await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.payment_method, 'cash');
    assert.equal(res.body.data.payment_status, 'unpaid');
  });

  test('rejects an unknown method (400)', async () => {
    const rider = await makeUser('rider');
    const res = await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini', payment_method: 'bitcoin' });
    assert.equal(res.status, 400);
  });
});

describe('POST /rides/:id/pay', () => {
  test('creates an order for the ride fare, in paise', async () => {
    const { rider, ride } = await completedRide();
    const res = await post(rider, `${ride.id}/pay`);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.amount, ride.fare * 100);
    assert.equal(res.body.data.currency, 'INR');
    assert.equal(res.body.data.key_id, 'rzp_test_unit');
    assert.ok(res.body.data.order_id);
  });

  test('a retry reuses the open order', async () => {
    const { rider, ride } = await completedRide();
    const a = await post(rider, `${ride.id}/pay`);
    const b = await post(rider, `${ride.id}/pay`);
    assert.equal(a.body.data.order_id, b.body.data.order_id);
  });

  test('refused for a cash ride (409)', async () => {
    const { rider, ride } = await completedRide('cash');
    assert.equal((await post(rider, `${ride.id}/pay`)).status, 409);
  });

  test('refused before the trip is completed (409)', async () => {
    const rider = await makeUser('rider');
    const ride = (await api().post('/api/rides').set(auth(rider.token))
      .send({ pickup: PICKUP, drop: DROP, vehicle_type: 'mini', payment_method: 'online' })).body.data;
    assert.equal((await post(rider, `${ride.id}/pay`)).status, 409);
  });

  test("someone else's ride is a 404, and drivers cannot pay (403)", async () => {
    const { driver, ride } = await completedRide();
    const other = await makeUser('rider');
    assert.equal((await post(other, `${ride.id}/pay`)).status, 404);
    assert.equal((await post(driver, `${ride.id}/pay`)).status, 403);
  });
});

describe('POST /rides/:id/pay/verify', () => {
  test('a valid signature marks the ride paid', async () => {
    const { rider, ride } = await completedRide();
    const order = (await post(rider, `${ride.id}/pay`)).body.data;
    const paymentId = 'pay_test_1';
    const res = await post(rider, `${ride.id}/pay/verify`, {
      razorpay_order_id: order.order_id,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(order.order_id, paymentId),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.payment_status, 'paid');
  });

  test('a wrong signature is refused and the ride stays unpaid (400)', async () => {
    const { rider, ride } = await completedRide();
    const order = (await post(rider, `${ride.id}/pay`)).body.data;
    const res = await post(rider, `${ride.id}/pay/verify`, {
      razorpay_order_id: order.order_id,
      razorpay_payment_id: 'pay_test_2',
      razorpay_signature: sign(order.order_id, 'pay_test_2', 'some-other-secret'),
    });
    assert.equal(res.status, 400);
    const view = await api().get(`/api/rides/${ride.id}`).set(auth(rider.token));
    assert.equal(view.body.data.payment_status, 'unpaid');
  });

  test('confirming twice is harmless; a paid ride cannot start a new order (409)', async () => {
    const { rider, ride } = await completedRide();
    const order = (await post(rider, `${ride.id}/pay`)).body.data;
    const body = {
      razorpay_order_id: order.order_id,
      razorpay_payment_id: 'pay_test_3',
      razorpay_signature: sign(order.order_id, 'pay_test_3'),
    };
    assert.equal((await post(rider, `${ride.id}/pay/verify`, body)).status, 200);
    assert.equal((await post(rider, `${ride.id}/pay/verify`, body)).status, 200);
    assert.equal((await post(rider, `${ride.id}/pay`)).status, 409);
  });

  test("an order from another ride cannot be used (400)", async () => {
    const a = await completedRide();
    const orderA = (await post(a.rider, `${a.ride.id}/pay`)).body.data;
    const b = await completedRide();
    const res = await post(b.rider, `${b.ride.id}/pay/verify`, {
      razorpay_order_id: orderA.order_id,
      razorpay_payment_id: 'pay_test_4',
      razorpay_signature: sign(orderA.order_id, 'pay_test_4'),
    });
    assert.equal(res.status, 400);
  });
});
