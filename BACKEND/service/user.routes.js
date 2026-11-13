const router = require('express').Router();
const userBusiness = require('../business/user.business');
const requireAuth = require('./auth.middleware');
const { ok } = require('../function/response');

router.get('/me', requireAuth, async (req, res) => {
  res.json(ok(await userBusiness.getMe(req.user)));
});

module.exports = router;
