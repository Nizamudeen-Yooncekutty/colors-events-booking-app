const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Employee = require('../models/Employee');

const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Load RSA keys for RS256 — fall back to HS256 with JWT_SECRET if keys are not available
let privateKey, publicKey, algorithm;
try {
  privateKey = fs.readFileSync(path.join(__dirname, '../../jwt-private.pem'), 'utf8');
  publicKey = fs.readFileSync(path.join(__dirname, '../../jwt-public.pem'), 'utf8');
  algorithm = 'RS256';
} catch {
  privateKey = null;
  publicKey = null;
  algorithm = 'HS256';
}

function getSigningKey() {
  return algorithm === 'RS256' ? privateKey : process.env.JWT_SECRET;
}

function getVerifyKey() {
  return algorithm === 'RS256' ? publicKey : process.env.JWT_SECRET;
}

const generateRefreshToken = (employeeId, tokenVersion) => {
  return jwt.sign(
    { employeeId, tokenVersion, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    getSigningKey(),
    { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm }
  );
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
};

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length > 4096) {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }

    const decoded = jwt.verify(token, getVerifyKey(), {
      algorithms: [algorithm],
      maxAge: process.env.JWT_EXPIRES_IN || '1h',
    });

    if (!decoded.employeeId) {
      return res.status(401).json({ message: 'Not authorized, malformed token' });
    }

    const employee = await Employee.findOne({ employeeId: decoded.employeeId }).select('-password');

    if (!employee || !employee.isActive) {
      return res.status(401).json({ message: 'Not authorized, account inactive' });
    }

    // Server-side token invalidation: reject tokens issued before the current version
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== employee.tokenVersion) {
      return res.status(401).json({ message: 'Session invalidated, please login again' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired, please login again' });
    }
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.employee.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const adminOrVolunteer = (req, res, next) => {
  if (!['admin', 'volunteer'].includes(req.employee.role)) {
    return res.status(403).json({ message: 'Admin or volunteer access required' });
  }
  next();
};

const generateToken = (employeeId, role, tokenVersion) => {
  return jwt.sign({ employeeId, role, tokenVersion }, getSigningKey(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    algorithm,
  });
};

const verifyToken = (token, options = {}) => {
  return jwt.verify(token, getVerifyKey(), { algorithms: [algorithm], ...options });
};

module.exports = { protect, adminOnly, adminOrVolunteer, generateToken, generateRefreshToken, setRefreshCookie, clearRefreshCookie, verifyToken, algorithm };
