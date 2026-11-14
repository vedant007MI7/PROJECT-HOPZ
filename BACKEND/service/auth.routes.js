const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const authBusiness = require('../business/auth.business');
const passwordReset = require('../business/password-reset.business');
const validate = require('./validate');
const schemas = require('./schemas/auth.schema');
const { ok, fail } = require('../function/response');

// Slows password guessing. Off in tests, which sign up many users quickly.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  handler: (req, res) => res.status(429).json(fail('Too many attempts, try again later')),
});

router.post('/signup', authLimiter, validate(schemas.signup), async (req, res) => {
  const data = await authBusiness.signup(req.valid.body);
  res.status(201).json(ok(data));
});

router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  res.json(ok(await authBusiness.login(req.valid.body)));
});

// Always answers the same way, so it cannot be used to find out which emails have accounts.
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), async (req, res) => {
  res.json(ok(await passwordReset.requestReset(req.valid.body)));
});

router.post('/reset-password', authLimiter, validate(schemas.resetPassword), async (req, res) => {
  res.json(ok(await passwordReset.resetPassword(req.valid.body)));
});

module.exports = router;
