const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const rideBusiness = require('../business/ride.business');
const paymentBusiness = require('../business/payment.business');
const requireAuth = require('./auth.middleware');
const requireRole = require('./role.middleware');
const validate = require('./validate');
const idempotent = require('./idempotency.middleware');
const schemas = require('./schemas/ride.schema');
const { ROLES } = require('../function/constants');
const { ok, fail } = require('../function/response');

const rider = requireRole(ROLES.RIDER);
const driver = requireRole(ROLES.DRIVER);
const withId = validate(schemas.rideIdParam, 'params');

router.use(requireAuth);

// Stops one rider from spamming ride requests. Counted per user (the route is behind login). Off in tests.
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rideCreateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.id),
  skip: () => config.nodeEnv === 'test',
  handler: (req, res) => res.status(429).json(fail('Too many ride requests, wait a minute and try again')),
});

// #6
router.post('/', rider, idempotent, createLimiter, validate(schemas.createRide), async (req, res) => {
  res.status(201).json(ok(await rideBusiness.createRide(req.user, req.valid.body)));
});

// #8
router.get('/', validate(schemas.listRides, 'query'), async (req, res) => {
  const { rides, nextCursor } = await rideBusiness.listRides(req.user, req.valid.query);
  res.json({ ...ok(rides), next_cursor: nextCursor });
});

// #7
router.get('/:id', withId, async (req, res) => {
  res.json(ok(await rideBusiness.getRide(req.user, req.valid.params.id)));
});

// #9 (rider or driver; the business layer checks they belong to the ride)
router.post('/:id/cancel', withId, async (req, res) => {
  res.json(ok(await rideBusiness.cancelRide(req.user, req.valid.params.id)));
});

// #10
router.post('/:id/accept', driver, withId, async (req, res) => {
  res.json(ok(await rideBusiness.acceptRide(req.user, req.valid.params.id)));
});

// #11
router.post('/:id/decline', driver, withId, async (req, res) => {
  res.json(ok(await rideBusiness.declineRide(req.user, req.valid.params.id)));
});

// #12
router.post('/:id/arrived', driver, withId, async (req, res) => {
  res.json(ok(await rideBusiness.markArrived(req.user, req.valid.params.id)));
});

// #13
router.post('/:id/start', driver, withId, validate(schemas.startRide), async (req, res) => {
  res.json(ok(await rideBusiness.startRide(req.user, req.valid.params.id, req.valid.body.pin)));
});

// #14
router.post('/:id/complete', driver, withId, async (req, res) => {
  res.json(ok(await rideBusiness.completeRide(req.user, req.valid.params.id)));
});

// #15
router.post('/:id/rating', rider, withId, validate(schemas.rateRide), async (req, res) => {
  const data = await rideBusiness.rateRide(req.user, req.valid.params.id, req.valid.body);
  res.status(201).json(ok(data));
});

// #16 start an online payment for a completed ride
router.post('/:id/pay', rider, idempotent, withId, async (req, res) => {
  res.status(201).json(ok(await paymentBusiness.createPaymentOrder(req.user, req.valid.params.id)));
});

// #17 confirm it after Razorpay checkout; the signature is checked on the server
router.post('/:id/pay/verify', rider, withId, validate(schemas.verifyPayment), async (req, res) => {
  res.json(ok(await paymentBusiness.verifyPayment(req.user, req.valid.params.id, req.valid.body)));
});

module.exports = router;
