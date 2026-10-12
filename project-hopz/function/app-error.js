// Error with an HTTP status, thrown by any layer and turned into a response in app.js.
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

module.exports = { AppError };
