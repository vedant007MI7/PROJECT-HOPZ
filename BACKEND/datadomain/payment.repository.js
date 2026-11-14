const db = require('../wrapper/db');

const run = (client) => client || db;

const insert = async ({ rideId, orderId, amount }, client) => {
  const { rows } = await run(client).query(
    `INSERT INTO payments (ride_id, amount, razorpay_order_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [rideId, amount, orderId]
  );
  return rows[0];
};

// An order made earlier for this ride and not paid yet, so a retry reuses it.
const findOpenByRide = async (rideId, client) => {
  const { rows } = await run(client).query(
    `SELECT * FROM payments
     WHERE ride_id = $1 AND status = 'created'
     ORDER BY created_at DESC LIMIT 1`,
    [rideId]
  );
  return rows[0] || null;
};

const findByOrderId = async (orderId, client) => {
  const { rows } = await run(client).query(
    'SELECT * FROM payments WHERE razorpay_order_id = $1',
    [orderId]
  );
  return rows[0] || null;
};

const markPaid = async (orderId, paymentId, client) => {
  const { rows } = await run(client).query(
    `UPDATE payments
     SET status = 'paid', razorpay_payment_id = $2, paid_at = now()
     WHERE razorpay_order_id = $1 AND status = 'created'
     RETURNING *`,
    [orderId, paymentId]
  );
  return rows[0] || null;
};

module.exports = { insert, findOpenByRide, findByOrderId, markPaid };
