const crypto = require('crypto');
const router = require('express').Router();
const config = require('../config');
const metricsBusiness = require('../business/metrics.business');

const same = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Numbers about the server, for a monitoring tool. They can show how busy the service is, so:
//  - METRICS_TOKEN set: callers must send "Authorization: Bearer <token>".
//  - not set, in production: the route does not exist (404).
//  - not set, otherwise (local development): open.
router.get('/', async (req, res) => {
  if (config.metricsToken) {
    const sent = (req.get('Authorization') || '').replace(/^Bearer /, '');
    if (!same(sent, config.metricsToken)) return res.status(401).type('text/plain').send('Unauthorized\n');
  } else if (config.nodeEnv === 'production') {
    return res.status(404).type('text/plain').send('Not found\n');
  }
  return res.type('text/plain; version=0.0.4').send(await metricsBusiness.renderMetrics());
});

module.exports = router;
