const AppError = require('../function/app-error');

// Use after requireAuth.
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new AppError('Forbidden', 403);
  next();
};

module.exports = requireRole;
