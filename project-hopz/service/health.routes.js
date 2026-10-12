// GET /api/health - lets the mobile app check the API is up.
const { Router } = require('express');
const { ok } = require('../function/response');

const router = Router();

router.get('/', (req, res) => {
  res.json(ok({ status: 'up', time: new Date().toISOString() }));
});

module.exports = router;
