function idParam(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error(`${name} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return id;
}

function requiredText(value, name, maxLength = 255) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) {
    const error = new Error(`${name} is required and must be at most ${maxLength} characters`);
    error.status = 400;
    throw error;
  }
  return text;
}

function optionalText(value, maxLength = 2000) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function numberValue(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${name} must be between ${min} and ${max}`);
    error.status = 400;
    throw error;
  }
  return number;
}

module.exports = { idParam, requiredText, optionalText, numberValue };
