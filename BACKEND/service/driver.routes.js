const router = require('express').Router();
const driverBusiness = require('../business/driver.business');
const requireAuth = require('./auth.middleware');
const requireRole = require('./role.middleware');
const validate = require('./validate');
const schemas = require('./schemas/driver.schema');
const { ROLES } = require('../function/constants');
const { ok } = require('../function/response');

router.use(requireAuth, requireRole(ROLES.DRIVER));

// #16
router.post('/status', validate(schemas.setStatus), async (req, res) => {
  res.json(ok(await driverBusiness.setStatus(req.user, req.valid.body)));
});

// #17
router.get('/requests', async (req, res) => {
  res.json(ok(await driverBusiness.listRequests(req.user)));
});

// #18
router.post('/location', validate(schemas.updateLocation), async (req, res) => {
  res.json(ok(await driverBusiness.updateLocation(req.user, req.valid.body)));
});

// #19
router.get('/earnings', async (req, res) => {
  res.json(ok(await driverBusiness.getEarnings(req.user)));
});

module.exports = router;
