const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/keys',
  cache: true,
  cacheMaxEntries: 50,
  cacheMaxAge: 1000 * 60 * 60,
  rateLimit: true,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyAzureToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getSigningKey, { algorithms: ['RS256'] }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = { verifyAzureToken };
