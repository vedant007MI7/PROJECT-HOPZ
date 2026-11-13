const router = require('express').Router();
const healthBusiness = require('../business/health.business');
const { ok } = require('../function/response');

router.get('/', (req, res) => res.json(ok({ status: 'ok' })));

router.get('/db', async (req, res) => res.json(ok(await healthBusiness.checkDb())));

module.exports = router;
