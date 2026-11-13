const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./service');
const logger = require('./wrapper/logger');
const AppError = require('./function/app-error');
const { fail } = require('./function/response');
const config = require('./config');

const app = express();

// Render (and most hosts) put a proxy in front: needed for correct client IPs in rate limiting.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(config.corsOrigins.length ? { origin: config.corsOrigins } : undefined));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json(fail('Route not found')));

// The only place errors become responses.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof AppError) return res.status(err.status).json(fail(err.message));

  // body-parser errors: bad JSON, body too large.
  if (err.type === 'entity.parse.failed') return res.status(400).json(fail('Invalid JSON body'));
  if (err.type === 'entity.too.large') return res.status(413).json(fail('Request body too large'));

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json(fail('Internal server error'));
});

module.exports = app;
