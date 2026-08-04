const express = require('express');
const { body } = require('express-validator');
const Employee = require('../models/Employee');
const RoleUser = require('../models/RoleUser');
const { protect, generateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { verifyAzureToken } = require('../utils/azureAuth');

const router = express.Router();

const registerValidation = [
  body('employeeId')
    .trim()
    .notEmpty().withMessage('Employee ID is required')
    .isAlphanumeric().withMessage('Employee ID must be alphanumeric')
    .isLength({ min: 3, max: 20 }).withMessage('Employee ID must be 3-20 characters'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
    .matches(/^[a-zA-Z\s.'-]+$/).withMessage('Name contains invalid characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Department must be under 100 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Phone must be under 20 characters'),
  handleValidationErrors,
];

const loginValidation = [
  body('employeeId')
    .trim()
    .notEmpty().withMessage('Employee ID is required')
    .isLength({ max: 20 }).withMessage('Employee ID is too long'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password is too long'),
  handleValidationErrors,
];

// POST /api/auth/register
router.post('/register', registerValidation, async (req, res) => {
  try {
    const { employeeId, name, email, password, department, phone } = req.body;

    const exists = await Employee.findOne({
      $or: [{ email }, { employeeId: employeeId.toUpperCase() }],
    });
    if (exists) {
      return res.status(400).json({ message: 'Employee already registered' });
    }

    const employee = await Employee.create({
      employeeId,
      name,
      email,
      password,
      department,
      phone,
    });

    const safeEmployee = employee.toObject();
    delete safeEmployee.password;

    res.status(201).json({
      employee: safeEmployee,
      token: generateToken(employee._id),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Employee already registered' });
    }
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    const employee = await Employee.findOne({
      employeeId: employeeId.toUpperCase(),
    });

    if (!employee || !(await employee.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid Employee ID or password' });
    }

    if (!employee.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const safeEmployee = employee.toObject();
    delete safeEmployee.password;

    res.json({
      employee: safeEmployee,
      token: generateToken(employee._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/sso - authenticate via Azure AD SSO token
router.post('/sso', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const idToken = authHeader.split(' ')[1];
    const decoded = await verifyAzureToken(idToken);

    if (!decoded.preferred_username && !decoded.email) {
      return res.status(401).json({ message: 'Invalid token: no email found' });
    }

    const email = (decoded.preferred_username || decoded.email).toLowerCase();
    const name = decoded.name || email.split('@')[0];
    const employeeId = email.split('@')[0].toUpperCase();

    // Check if user has a special role (admin/volunteer) in RoleUser collection
    const roleUser = await RoleUser.findOne({ email, isActive: true });
    const role = roleUser ? roleUser.role : 'employee';

    // Find or create the employee record
    let employee = await Employee.findOne({ email });

    if (!employee) {
      employee = await Employee.create({
        employeeId,
        name,
        email,
        password: require('crypto').randomBytes(32).toString('hex'),
        role,
        department: '',
        phone: '',
      });
    } else {
      // Update role if changed in RoleUser collection
      if (employee.role !== role) {
        employee.role = role;
        await employee.save();
      }
      if (!employee.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
    }

    const safeEmployee = employee.toObject();
    delete safeEmployee.password;

    res.json({
      employee: safeEmployee,
      token: generateToken(employee._id),
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired SSO token' });
    }
    res.status(500).json({ message: 'SSO authentication failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ employee: req.employee });
});

module.exports = router;
