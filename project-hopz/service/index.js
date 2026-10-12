// Mounts every route module under /api.
const { Router } = require('express');

const healthRoutes = require('./health.routes');
const userRoutes = require('./user.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/users', userRoutes);

module.exports = router;
