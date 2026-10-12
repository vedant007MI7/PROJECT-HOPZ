// User business rules. No Express (req/res) or DB details here.
const userRepository = require('../datadomain/user.repository');
const { AppError } = require('../function/app-error');
const { isNonEmptyString, isEmail } = require('../function/validators');

const listUsers = () => userRepository.findAll();

const getUser = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError('User not found', 404);
  return user;
};

const registerUser = async ({ name, email } = {}) => {
  if (!isNonEmptyString(name)) throw new AppError('Name is required');
  if (!isEmail(email)) throw new AppError('A valid email is required');

  const normalizedEmail = email.trim().toLowerCase();
  if (await userRepository.findByEmail(normalizedEmail)) {
    throw new AppError('Email already registered', 409);
  }

  return userRepository.create({ name: name.trim(), email: normalizedEmail });
};

module.exports = { listUsers, getUser, registerUser };
