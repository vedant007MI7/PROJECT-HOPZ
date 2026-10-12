// /api/users endpoints. Maps HTTP in/out; all rules live in the business layer.
const { Router } = require('express');
const userBusiness = require('../business/user.business');
const { ok } = require('../function/response');

const router = Router();

router.get('/', async (req, res) => {
  res.json(ok(await userBusiness.listUsers()));
});

router.get('/:id', async (req, res) => {
  res.json(ok(await userBusiness.getUser(req.params.id)));
});

router.post('/', async (req, res) => {
  const user = await userBusiness.registerUser(req.body);
  res.status(201).json(ok(user));
});

module.exports = router;
