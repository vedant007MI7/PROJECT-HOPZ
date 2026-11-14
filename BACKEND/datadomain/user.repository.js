const db = require('../wrapper/db');

// `client` is optional: pass the one from withTransaction to join a transaction.
const create = async ({ name, phone, email, passwordHash, role }, client) => {
  const { rows } = await (client || db).query(
    `INSERT INTO users (name, phone, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, phone || null, email, passwordHash, role]
  );
  return rows[0];
};

const findByEmail = async (email) => {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
};

const findByPhone = async (phone) => {
  const { rows } = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
};

const updatePassword = async (id, passwordHash, client) => {
  await (client || db).query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
};

module.exports = { create, findByEmail, findByPhone, findById, updatePassword };
