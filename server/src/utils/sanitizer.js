const xss = require('xss');

const SQL_PATTERN =
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|TRUNCATE|GRANT|REVOKE)\b)|--|\/\*|\*\/|xp_|sp_/i;

const NOSQL_OPERATORS = [
  '$where', '$ne', '$gt', '$lt', '$gte', '$lte', '$regex',
  '$or', '$and', '$not', '$nor', '$in', '$nin', '$exists',
  '$expr', '$jsonSchema', '$mod', '$text', '$geoWithin',
];

const COMMAND_INJECTION_PATTERN = /&&|\|\||\$\(|`/;
const PATH_TRAVERSAL_PATTERN = /\.\.\//;
const NULL_BYTE_PATTERN = /\x00/;

function hasSQLInjection(value) {
  return typeof value === 'string' && SQL_PATTERN.test(value);
}

function hasNoSQLInjection(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  for (const key of Object.keys(obj)) {
    if (NOSQL_OPERATORS.includes(key.toLowerCase())) return true;
    if (typeof obj[key] === 'object' && hasNoSQLInjection(obj[key])) return true;
  }
  return false;
}

function hasCommandInjection(value) {
  return typeof value === 'string' && COMMAND_INJECTION_PATTERN.test(value);
}

function hasPathTraversal(value) {
  return typeof value === 'string' && PATH_TRAVERSAL_PATTERN.test(value);
}

function hasNullByte(value) {
  return typeof value === 'string' && NULL_BYTE_PATTERN.test(value);
}

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value.trim());
}

function sanitizeObject(obj) {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj !== 'object' || obj === null) return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeObject(value);
  }
  return result;
}

function runSecurityChecks(data) {
  if (typeof data === 'string') {
    if (hasSQLInjection(data)) return 'Potentially unsafe input detected';
    if (hasCommandInjection(data)) return 'Potentially unsafe input detected';
    if (hasPathTraversal(data)) return 'Potentially unsafe input detected';
    if (hasNullByte(data)) return 'Potentially unsafe input detected';
  }

  if (typeof data === 'object' && data !== null) {
    if (hasNoSQLInjection(data)) return 'Potentially unsafe input detected';
    for (const value of Object.values(data)) {
      const result = runSecurityChecks(value);
      if (result) return result;
    }
  }

  return null;
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  runSecurityChecks,
  hasSQLInjection,
  hasNoSQLInjection,
};
