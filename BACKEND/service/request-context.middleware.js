const crypto = require('crypto');
const logger = require('../wrapper/logger');
const metrics = require('../wrapper/metrics');

// Only plain, short ids are accepted from the client, so a caller cannot put odd text into our logs.
const SAFE_ID = /^[A-Za-z0-9_.-]{8,64}$/;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// The route as a pattern, such as /api/rides/:id, so one series covers every ride id.
// A request that matched no route is "unmatched", so random URLs cannot create endless series.
// (req.baseUrl cannot be used here: Express has already reset it by the time the response finishes.)
function routeLabel(req) {
  if (!req.route) return 'unmatched';
  const path = req.originalUrl.split('?')[0].replace(UUID, ':id');
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

// Gives every request an id (the client's X-Request-Id, or a new one), returns it in the response header,
// puts it on every log line for that request (req.log), and records how long the request took.
// With the id, one failed request can be found across all log lines, and a user can quote it in a bug report.
function requestContext(req, res, next) {
  const incoming = req.get('X-Request-Id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  req.log = logger.child({ reqId: req.id });

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = routeLabel(req);
    metrics.observeRequest({ method: req.method, route, status: res.statusCode, seconds });
    // The health check is called every few seconds by the host; logging it would bury everything else.
    if (route === '/api/health') return;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    req.log[level]({
      method: req.method,
      route,
      status: res.statusCode,
      ms: Math.round(seconds * 1000),
      userId: req.user ? req.user.id : undefined,
    }, 'request');
  });
  next();
}

module.exports = requestContext;
