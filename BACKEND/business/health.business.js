const healthRepo = require('../datadomain/health.repository');
const AppError = require('../function/app-error');

const checkDb = async () => {
  try {
    await healthRepo.ping();
  } catch {
    throw new AppError('Database unreachable', 503);
  }
  return { status: 'ok', db: 'up' };
};

module.exports = { checkDb };
