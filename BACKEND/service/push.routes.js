const router = require('express').Router();
const pushBusiness = require('../business/push.business');
const requireAuth = require('./auth.middleware');
const validate = require('./validate');
const schemas = require('./schemas/push.schema');
const { ok } = require('../function/response');

// #20
router.post('/', requireAuth, validate(schemas.saveToken), async (req, res) => {
  res.json(ok(await pushBusiness.saveToken(req.user, req.valid.body)));
});

module.exports = router;
