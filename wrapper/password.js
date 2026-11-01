const bcrypt = require('bcryptjs');

const ROUNDS = 10;

const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, comparePassword };
