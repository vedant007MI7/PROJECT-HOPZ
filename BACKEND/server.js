const config = require('./config');
const app = require('./app');
const db = require('./wrapper/db');
const logger = require('./wrapper/logger');
const realtime = require('./wrapper/realtime');
const queue = require('./wrapper/queue');
const jobs = require('./business/jobs.business');

// While draining, /api/health answers 503 so a load balancer stops sending new requests here.
const server = app.listen(config.port, () => {
  logger.info(`Hopz API listening on port ${config.port} (${config.nodeEnv})`);
});

realtime.attach(server);
queue.startWorker(jobs.handlers); // does nothing unless QUEUE_ENABLED=true

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  app.locals.draining = true;
  // Stop taking requests, let in-flight ones finish, then close the DB pool.
  realtime.close();
  server.close(async () => {
    await queue.close().catch(() => {});
    await db.pool.end().catch(() => {});
    process.exit(0);
  });
  // Don't hang forever on stuck connections.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
