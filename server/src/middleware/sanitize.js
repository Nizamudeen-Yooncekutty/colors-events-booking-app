const { sanitizeObject, runSecurityChecks } = require('../utils/sanitizer');

function sanitizeInputs(req, res, next) {
  const securityViolation = runSecurityChecks(req.body);
  if (securityViolation) {
    return res.status(400).json({ message: securityViolation });
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = value.trim();
      }
    }
  }

  next();
}

module.exports = { sanitizeInputs };
