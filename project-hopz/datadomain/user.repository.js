// User data access. In-memory for now; swap the internals for a real DB later
// without changing the functions' signatures.
const { randomUUID } = require('node:crypto');
const { User } = require('../models/user.model');

const users = new Map();

const findAll = async () => [...users.values()];

const findById = async (id) => users.get(id) || null;

const findByEmail = async (email) =>
  [...users.values()].find((u) => u.email === email) || null;

const create = async ({ name, email }) => {
  const user = new User({ id: randomUUID(), name, email, createdAt: new Date().toISOString() });
  users.set(user.id, user);
  return user;
};

module.exports = { findAll, findById, findByEmail, create };
