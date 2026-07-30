const express = require('express');
const Employee = require('../models/Employee');
const { protect, generateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
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

    res.status(201).json({
      employee,
      token: generateToken(employee._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
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

    res.json({
      employee,
      token: generateToken(employee._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ employee: req.employee });
});

module.exports = router;
