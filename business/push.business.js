const AppError = require('../function/app-error');

// #20 POST /push-tokens (any)
// 1. upsert({ userId: user.id, token, platform }): same token again just updates platform
//    and updated_at; if another user had it, it moves to this user.
// 2. Return { token, platform }.
const saveToken = async (user, input) => {
  throw new AppError('Not implemented yet', 501);
};

module.exports = { saveToken };
