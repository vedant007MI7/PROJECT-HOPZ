// Pure validation helpers.
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

module.exports = { isNonEmptyString, isEmail };
