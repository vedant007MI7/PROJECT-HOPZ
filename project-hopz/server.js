// Entry point: loads config and starts the HTTP server.
require('dotenv').config();

const app = require('./app');
const logger = require('./wrapper/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`HOPZ API listening on http://localhost:${PORT}`);
});
