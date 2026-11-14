const rideRepo = require('../datadomain/ride.repository');
const paymentRepo = require('../datadomain/payment.repository');
const razorpay = require('../wrapper/razorpay');
const db = require('../wrapper/db');
const config = require('../config');
const AppError = require('../function/app-error');
const { RIDE_STATUS } = require('../function/constants');
const { toRide } = require('../models/ride.model');

const NOT_FOUND = 'Ride not found';

// Step 1: the rider asks to pay for a completed ride. The amount always comes from the ride row,
// never from the client. A retry reuses the order that is still open.
async function createPaymentOrder(user, rideId) {
  const ride = await rideRepo.findById(rideId);
  if (!ride || ride.rider_id !== user.id) throw new AppError(NOT_FOUND, 404);
  if (ride.status !== RIDE_STATUS.COMPLETED) throw new AppError('You can pay once the trip is completed', 409);
  if (ride.payment_method !== 'online') throw new AppError('This ride is paid in cash', 409);
  if (ride.payment_status === 'paid') throw new AppError('This ride is already paid', 409);

  let payment = await paymentRepo.findOpenByRide(rideId);
  if (!payment) {
    const amount = ride.fare * 100; // paise
    const order = await razorpay.createOrder({ amountPaise: amount, receipt: ride.id, notes: { ride_id: ride.id } });
    payment = await paymentRepo.insert({ rideId, orderId: order.id, amount });
  }
  return {
    ride_id: rideId,
    order_id: payment.razorpay_order_id,
    amount: payment.amount,
    currency: payment.currency,
    key_id: config.razorpayKeyId,
  };
}

// Step 2: checkout succeeded in the app. The signature proves Razorpay (not the app) says it was paid.
async function verifyPayment(user, rideId, input) {
  await db.withTransaction(async (client) => {
    const ride = await rideRepo.findById(rideId, client, true);
    if (!ride || ride.rider_id !== user.id) throw new AppError(NOT_FOUND, 404);

    const payment = await paymentRepo.findByOrderId(input.razorpay_order_id, client);
    if (!payment || payment.ride_id !== rideId) throw new AppError('This payment does not belong to this ride', 400);
    if (!razorpay.verifySignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
      throw new AppError('Payment could not be verified', 400);
    }
    if (ride.payment_status === 'paid') return; // already confirmed: calling again is harmless

    await paymentRepo.markPaid(input.razorpay_order_id, input.razorpay_payment_id, client);
    await rideRepo.setPaid(rideId, client);
  });
  return toRide(await rideRepo.findById(rideId), user.id);
}

module.exports = { createPaymentOrder, verifyPayment };
