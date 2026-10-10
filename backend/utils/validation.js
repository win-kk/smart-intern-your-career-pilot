function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function numeric(value) {
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
}
function idParam(value, name) {
  if (!numeric(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) invalid(`${name} must be a positive integer`);
  return Number(value);
}
function requiredText(value, name, maxLength = 255) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) invalid(`${name} is required and must be at most ${maxLength} characters`);
  return value.trim();
}
function optionalText(value, maxLength = 2000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) invalid(`Text must be at most ${maxLength} characters`);
  return value.trim() || null;
}
function numberValue(value, name, min, max) {
  if (!numeric(value) || Number(value) < min || Number(value) > max) invalid(`${name} must be between ${min} and ${max}`);
  return Number(value);
}
function integerValue(value, name, min, max) {
  const number = numberValue(value, name, min, max);
  if (!Number.isSafeInteger(number)) invalid(`${name} must be an integer`);
  return number;
}
function booleanValue(value, name) {
  if (value === undefined) return false;
  if (value === true || value === 1 || value === 'true' || value === '1') return true;
  if (value === false || value === 0 || value === 'false' || value === '0') return false;
  invalid(`${name} must be true or false`);
}
function dateValue(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${name} must be a valid YYYY-MM-DD date`);
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid(`${name} must be a valid YYYY-MM-DD date`);
  return value;
}
module.exports = { idParam, requiredText, optionalText, numberValue, integerValue, booleanValue, dateValue };
