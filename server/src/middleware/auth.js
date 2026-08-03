const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length > 2048) {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: process.env.JWT_EXPIRES_IN || '7d',
    });

    if (!decoded.id) {
      return res.status(401).json({ message: 'Not authorized, malformed token' });
    }

    const employee = await Employee.findById(decoded.id).select('-password');

    if (!employee || !employee.isActive) {
      return res.status(401).json({ message: 'Not authorized, account inactive' });
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

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });
};

module.exports = { protect, adminOnly, adminOrVolunteer, generateToken };
