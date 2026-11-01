const config = require('./config');
const app = require('./app');
const db = require('./wrapper/db');
const logger = require('./wrapper/logger');

const server = app.listen(config.port, () => {
  logger.info(`Hopz API listening on port ${config.port} (${config.nodeEnv})`);
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  // Stop taking requests, let in-flight ones finish, then close the DB pool.
  server.close(async () => {
    await db.pool.end().catch(() => {});
    process.exit(0);
  });
  // Don't hang forever on stuck connections.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
