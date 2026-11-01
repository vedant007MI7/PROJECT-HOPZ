const db = require('../wrapper/db');

const ping = async () => {
  await db.query('SELECT 1');
};

module.exports = { ping };
