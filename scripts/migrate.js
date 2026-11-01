const fs = require('fs');
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
