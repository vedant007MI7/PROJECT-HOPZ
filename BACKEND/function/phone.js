// One stored format so the same number always matches: +<country code><digits>.
// A bare 10-digit Indian mobile number (starts 6-9) gets +91, so people can log in with just the 10 digits.
// Returns null if it is not a phone number.
function normalizePhone(raw) {
  const compact = String(raw).replace(/[\s\-().]/g, '');
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

module.exports = { normalizePhone };
