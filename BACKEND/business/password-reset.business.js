const crypto = require('crypto');
const userRepo = require('../datadomain/user.repository');
const otpRepo = require('../datadomain/otp.repository');
const db = require('../wrapper/db');
const mailer = require('../wrapper/mailer');
const sms = require('../wrapper/sms');
const { normalizePhone } = require('../function/phone');
const logger = require('../wrapper/logger');
const { hashPassword } = require('../wrapper/password');
const config = require('../config');
const AppError = require('../function/app-error');

const PURPOSE = 'password_reset';
// The same answer whether or not the email has an account, so the endpoint can't be used to look emails up.
const SENT = { message: 'If that email has an account, a code has been sent.' };
const BAD_CODE = 'Invalid or expired code';

// Only a hash is stored, keyed with the server secret: a leaked table does not reveal the codes.
const hashCode = (code) => crypto.createHmac('sha256', config.jwtSecret).update(code).digest('hex');

const sameHash = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// An identifier with an @ is an email; anything else is read as a phone number.
const isEmail = (identifier) => identifier.includes('@');

async function findUser(identifier) {
  if (isEmail(identifier)) return userRepo.findByEmail(identifier.toLowerCase());
  const phone = normalizePhone(identifier);
  return phone ? userRepo.findByPhone(phone) : null;
}

async function requestReset({ identifier }) {
  const user = await findUser(identifier);
  if (!user) return SENT;

  // A code was sent a moment ago: do nothing (still the same reply), so the inbox can't be flooded.
  const latest = await otpRepo.findLatest(user.id, PURPOSE);
  if (latest && !latest.used_at && Number(latest.age_seconds) < config.otpResendSeconds) return SENT;

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await otpRepo.replace({ userId: user.id, purpose: PURPOSE, codeHash: hashCode(code), ttlMinutes: config.otpTtlMinutes });
  try {
    // The code goes back to where the person asked from: a phone number gets an SMS, an email gets an email.
    if (isEmail(identifier)) {
      await mailer.sendResetCode({ to: user.email, name: user.name, code, minutes: config.otpTtlMinutes });
    } else {
      await sms.sendCode({ to: user.phone, code, minutes: config.otpTtlMinutes });
    }
  } catch (err) {
    // The reply stays the same; the failure is in the log.
    logger.error({ err }, 'Could not send the password reset code');
  }
  return SENT;
}

async function resetPassword({ identifier, code, new_password: newPassword }) {
  const user = await findUser(identifier);

  // Decide inside the transaction but throw after it, so a wrong guess is still counted.
  const outcome = await db.withTransaction(async (client) => {
    const otp = user ? await otpRepo.findLatest(user.id, PURPOSE, client, true) : null;
    if (!otp || otp.used_at || otp.expired || otp.attempts >= config.otpMaxAttempts) return { bad: true };

    if (!sameHash(hashCode(code), otp.code_hash)) {
      await otpRepo.addAttempt(otp.id, client);
      return { bad: true };
    }
    await userRepo.updatePassword(user.id, await hashPassword(newPassword), client);
    await otpRepo.markUsed(otp.id, client);
    return { ok: true };
  });

  if (outcome.bad) throw new AppError(BAD_CODE, 400);
  return { message: 'Password updated. You can log in now.' };
}

module.exports = { requestReset, resetPassword };
