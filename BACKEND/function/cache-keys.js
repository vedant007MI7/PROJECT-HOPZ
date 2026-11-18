const { EARNINGS_TIMEZONE } = require('./constants');

// The driver's earnings screen. The date (in the earnings timezone) is part of the key, so "today" is never
// carried over past midnight.
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: EARNINGS_TIMEZONE });
const earnings = (driverId) => `earnings:${driverId}:${today()}`;

module.exports = { earnings };
