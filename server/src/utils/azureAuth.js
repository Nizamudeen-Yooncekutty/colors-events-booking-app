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
    const options = {
      algorithms: ['RS256'],
    };

    if (process.env.AZURE_CLIENT_ID) {
      options.audience = process.env.AZURE_CLIENT_ID;
    }
    if (process.env.AZURE_TENANT_ID) {
      options.issuer = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`;
    }

    jwt.verify(token, getSigningKey, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = { verifyAzureToken };
