const { validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => e.msg);
    return res.status(400).json({
      message: messages[0],
      errors: messages,
    });
  }
  next();
}

module.exports = { handleValidationErrors };
