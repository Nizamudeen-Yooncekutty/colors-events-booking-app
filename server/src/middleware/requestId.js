const crypto = require('crypto');

const VALID_ID_PATTERN = /^[a-zA-Z0-9\-_.]{1,128}$/;

function requestId(req, res, next) {
  let id = req.headers['x-request-id'];
  if (!id || !VALID_ID_PATTERN.test(id)) {
    id = crypto.randomUUID();
  }
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = { requestId };
