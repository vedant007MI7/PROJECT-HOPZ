const userRepo = require('../datadomain/user.repository');
const driverProfileRepo = require('../datadomain/driver-profile.repository');
const db = require('../wrapper/db');
const { hashPassword, comparePassword } = require('../wrapper/password');
const { signToken } = require('../wrapper/token');
const { toUser } = require('../models/user.model');
const { toDriverProfile } = require('../models/driver-profile.model');
const AppError = require('../function/app-error');
const { ROLES } = require('../function/constants');
const { normalizePhone } = require('../function/phone');

const UNIQUE_VIOLATION = '23505';

// Compared against when the email is unknown, so timing does not reveal which emails exist.
const dummyHash = hashPassword('not-a-real-password');

async function signup(input) {
  const email = input.email.toLowerCase();

  if (await userRepo.findByEmail(email)) {
    throw new AppError('Email already registered', 409);
  }

  if (input.phone && (await userRepo.findByPhone(input.phone))) {
    throw new AppError('Phone number already registered', 409);
  }

  const passwordHash = await hashPassword(input.password);

  let created;
  try {
    // Driver and profile are created together or not at all.
    created = await db.withTransaction(async (client) => {
      const row = await userRepo.create(
        { name: input.name, phone: input.phone, email, passwordHash, role: input.role },
        client
      );
      let profile = null;
      if (input.role === ROLES.DRIVER) {
        profile = await driverProfileRepo.create(
          {
            userId: row.id,
            vehicleType: input.vehicle_type,
            vehicleModel: input.vehicle_model,
            plate: input.plate,
          },
          client
        );
      }
      return { row, profile };
    });
  } catch (err) {
    // Two signups with the same email or phone racing past the checks above.
    if (err.code === UNIQUE_VIOLATION) {
      const phoneClash = /phone/.test(err.constraint || '');
      throw new AppError(phoneClash ? 'Phone number already registered' : 'Email already registered', 409);
    }
    throw err;
  }

  const user = toUser(created.row);
  if (created.profile) user.driver_profile = toDriverProfile(created.profile);
  return { user, token: signToken(created.row) };
}

const BAD_LOGIN = 'Invalid email/phone or password';

// The account an identifier points to: by email if it has an @, otherwise by phone number.
async function findByIdentifier(identifier) {
  if (identifier.includes('@')) return userRepo.findByEmail(identifier.toLowerCase());
  const phone = normalizePhone(identifier);
  return phone ? userRepo.findByPhone(phone) : null;
}

async function login({ identifier, password }) {
  const row = await findByIdentifier(identifier);
  // Compared against a dummy hash when nothing matches, so timing does not reveal which identifiers exist.
  const matches = await comparePassword(password, row ? row.password_hash : await dummyHash);

  // Same error whether the identifier or the password was wrong.
  if (!row || !matches) throw new AppError(BAD_LOGIN, 401);

  const user = toUser(row);
  if (row.role === ROLES.DRIVER) {
    const profile = await driverProfileRepo.findByUserId(row.id);
    if (profile) user.driver_profile = toDriverProfile(profile);
  }
  return { user, token: signToken(row) };
}

module.exports = { signup, login };
