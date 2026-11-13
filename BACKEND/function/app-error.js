// Thrown anywhere; the central error handler turns it into the JSON envelope.
class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = AppError;
