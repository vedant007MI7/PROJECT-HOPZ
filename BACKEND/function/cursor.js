const AppError = require('./app-error');

// A "cursor" marks where the last page ended: the ride's request time and id. The client hands it back
// unchanged to get the next page. The time is kept as the database's own text (microseconds), because
// a JavaScript Date only holds milliseconds and would make rides repeat or vanish between pages.
const TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:?\d{2})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encodeCursor = ({ requestedAtText, id }) =>
  Buffer.from(`${requestedAtText}|${id}`, 'utf8').toString('base64url');

function decodeCursor(cursor) {
  const [requestedAtText, id, extra] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (extra !== undefined || !TIME.test(requestedAtText || '') || !UUID.test(id || '')) {
    throw new AppError('Invalid cursor', 400);
  }
  return { requestedAtText, id };
}

module.exports = { encodeCursor, decodeCursor };
