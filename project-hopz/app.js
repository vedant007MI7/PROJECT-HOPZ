// Builds the Express app: middleware, routes, error handling.
const express = require('express');

const routes = require('./service');
const { AppError } = require('./function/app-error');
const { fail } = require('./function/response');
const logger = require('./wrapper/logger');

const app = express();

app.use(express.json());

app.use('/api', routes);

// Unknown route
app.use((req, res) => {
  res.status(404).json(fail('Route not found'));
});

// Central error handler (Express 5 forwards async errors here automatically)
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json(fail(err.message));
  }
  logger.error(err);
  res.status(500).json(fail('Internal server error'));
});

module.exports = app;
