const ok = (data) => ({ success: true, data });
const fail = (error) => ({ success: false, error });

module.exports = { ok, fail };
