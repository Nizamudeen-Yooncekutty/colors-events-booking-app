const express = require('express');
const Employee = require('../models/Employee');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/dashboard
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const totalEvents = await Event.countDocuments();
    const activeEvents = await Event.countDocuments({ status: 'active' });
    const totalBookings = await Booking.countDocuments({ status: { $ne: 'cancelled' } });
    const totalCheckedIn = await Booking.countDocuments({ status: 'checked_in' });

    // Recent events with stats
    const recentEvents = await Event.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    for (const event of recentEvents) {
      event.bookingCount = await Booking.countDocuments({
        event: event._id,
        status: { $ne: 'cancelled' },
      });
      event.checkedInCount = await Booking.countDocuments({
        event: event._id,
        status: 'checked_in',
      });
    }

    res.json({
      stats: {
        totalEmployees,
        totalEvents,
        activeEvents,
        totalBookings,
        totalCheckedIn,
      },
      recentEvents,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/events/:eventId/bookings - list bookings for an event
router.get('/events/:eventId/bookings', protect, adminOnly, async (req, res) => {
  try {
    const { status, food, search, slot } = req.query;
    const filter = { event: req.params.eventId };

    if (status) filter.status = status;
    if (food) filter.foodPreference = food;
    if (slot) filter.timeSlot = slot;

    let bookings = await Booking.find(filter)
      .populate('employee', 'name employeeId email department phone')
      .populate('event', 'title eventDate')
      .sort({ createdAt: -1 });

    if (search) {
      const s = search.toLowerCase();
      bookings = bookings.filter(b =>
        b.employee.name.toLowerCase().includes(s) ||
        b.employee.employeeId.toLowerCase().includes(s) ||
        b.employee.email.toLowerCase().includes(s)
      );
    }

    // Stats
    const stats = {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      checkedIn: bookings.filter(b => b.status === 'checked_in').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
    };

    res.json({ bookings, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/employees - list all employees
router.get('/employees', protect, adminOnly, async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter = {};

    if (role) filter.role = role;

    let employees = await Employee.find(filter)
      .select('-password')
      .sort({ name: 1 });

    if (search) {
      const s = search.toLowerCase();
      employees = employees.filter(e =>
        e.name.toLowerCase().includes(s) ||
        e.employeeId.toLowerCase().includes(s) ||
        e.email.toLowerCase().includes(s)
      );
    }

    res.json({ employees, total: employees.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/employees/:id/role - change employee role
router.patch('/employees/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['employee', 'admin', 'volunteer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
