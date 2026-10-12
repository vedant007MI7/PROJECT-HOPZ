// Consistent JSON envelope for every API response, so the mobile app always gets the same shape.
const ok = (data) => ({ success: true, data });
const fail = (message) => ({ success: false, error: message });

module.exports = { ok, fail };
