const fs = require('fs');
require('dotenv').config();
// `npm run migrate:test` migrates the test database (TEST_DATABASE_URL) instead.
if (process.argv.includes('--test')) {
  if (!process.env.TEST_DATABASE_URL) {
    console.error('Set TEST_DATABASE_URL in .env first.');
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
const path = require('path');
// config exits with a clear message if DATABASE_URL is missing.
const db = require('../wrapper/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../datadomain/schema.sql'), 'utf8');
  await db.query(sql);
  console.log('Migration complete.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
