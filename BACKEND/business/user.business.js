const userRepo = require('../datadomain/user.repository');
const driverProfileRepo = require('../datadomain/driver-profile.repository');
const ratingRepo = require('../datadomain/rating.repository');
const { toUser } = require('../models/user.model');
const { toDriverProfile } = require('../models/driver-profile.model');
const AppError = require('../function/app-error');
const { ROLES } = require('../function/constants');

async function getMe(authUser) {
  const row = await userRepo.findById(authUser.id);
  // Token is valid but the account is gone.
  if (!row) throw new AppError('User not found', 404);

  const user = toUser(row);
  if (row.role === ROLES.DRIVER) {
    const profile = await driverProfileRepo.findByUserId(row.id);
    if (profile) {
      user.driver_profile = toDriverProfile(profile);
      const { average, count } = await ratingRepo.summaryForDriver(row.id);
      user.driver_profile.rating = { average: average === null ? null : Math.round(average * 10) / 10, count };
    }
  }
  return user;
}

module.exports = { getMe };
