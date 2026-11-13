const AppError = require('../function/app-error');

// Parsed values go to req.valid[source]; Express 5 makes req.query read-only.
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || source}: ${i.message}`)
      .join('; ');
    throw new AppError(message, 400);
  }
  req.valid = { ...req.valid, [source]: result.data };
  next();
};

module.exports = validate;
