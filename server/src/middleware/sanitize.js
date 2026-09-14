const { sanitizeObject, runSecurityChecks } = require('../utils/sanitizer');

function sanitizeInputs(req, res, next) {
  const bodyViolation = runSecurityChecks(req.body);
  if (bodyViolation) {
    return res.status(400).json({ message: bodyViolation });
  }

  const queryViolation = runSecurityChecks(req.query);
  if (queryViolation) {
    return res.status(400).json({ message: queryViolation });
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
