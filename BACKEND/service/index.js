const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/rides', require('./ride.routes'));
router.use('/drivers', require('./driver.routes'));
router.use('/push-tokens', require('./push.routes'));

module.exports = router;
