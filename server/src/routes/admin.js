const express = require('express');
const { body, param, query } = require('express-validator');
const Employee = require('../models/Employee');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const WalkIn = require('../models/WalkIn');
const RoleUser = require('../models/RoleUser');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// GET /api/admin/dashboard
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const totalEvents = await Event.countDocuments();
    const activeEvents = await Event.countDocuments({ status: 'active' });
    const totalBookings = await Booking.countDocuments({ status: { $ne: 'cancelled' } });
    const totalCheckedIn = await Booking.countDocuments({ status: 'checked_in' });
    const totalWalkIns = await WalkIn.countDocuments();

    const walkInByType = await WalkIn.aggregate([
      { $group: { _id: '$attendeeType', count: { $sum: 1 } } },
    ]);

    const walkInStats = { guest: 0, staff: 0, housekeeping: 0, unregistered_employee: 0 };
    walkInByType.forEach(w => { walkInStats[w._id] = w.count; });

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
      event.walkInCount = await WalkIn.countDocuments({ event: event._id });
    }

    res.json({
      stats: {
        totalEmployees,
        totalEvents,
        activeEvents,
        totalBookings,
        totalCheckedIn,
        totalWalkIns,
        walkInStats,
      },
      recentEvents,
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/events/:eventId/bookings - list bookings for an event
router.get('/events/:eventId/bookings', protect, adminOnly, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
  query('status').optional({ values: 'falsy' }).isIn(['confirmed', 'checked_in', 'cancelled']).withMessage('Invalid status filter'),
  query('role').optional({ values: 'falsy' }).isIn(['employee', 'admin', 'volunteer']).withMessage('Invalid role filter'),
], handleValidationErrors, async (req, res) => {
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
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/events/:eventId/report - comprehensive event report with classification
router.get('/events/:eventId/report', protect, adminOnly, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const bookings = await Booking.find({
      event: req.params.eventId,
      status: { $ne: 'cancelled' },
    })
      .populate('employee', 'name employeeId email department phone')
      .lean();

    const walkIns = await WalkIn.find({ event: req.params.eventId })
      .populate('checkedInBy', 'name employeeId')
      .lean();

    // Classification breakdown
    const classification = {
      employees: {
        total: bookings.length,
        checkedIn: bookings.filter(b => b.status === 'checked_in').length,
        pending: bookings.filter(b => b.status === 'confirmed').length,
      },
      guests: {
        total: walkIns.filter(w => w.attendeeType === 'guest').length,
      },
      staff: {
        total: walkIns.filter(w => w.attendeeType === 'staff').length,
      },
      housekeeping: {
        total: walkIns.filter(w => w.attendeeType === 'housekeeping').length,
      },
      unregisteredEmployees: {
        total: walkIns.filter(w => w.attendeeType === 'unregistered_employee').length,
      },
    };

    const totalAttendees = bookings.filter(b => b.status === 'checked_in').length + walkIns.length;

    // Food breakdown across all attendees
    const foodMap = {};
    bookings.forEach(b => {
      if (b.status !== 'cancelled') {
        foodMap[b.foodPreference] = (foodMap[b.foodPreference] || 0) + 1;
      }
    });
    walkIns.forEach(w => {
      if (w.foodPreference) {
        foodMap[w.foodPreference] = (foodMap[w.foodPreference] || 0) + 1;
      }
    });
    const foodBreakdown = Object.entries(foodMap).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Slot breakdown
    const slotMap = {};
    if (event.timeSlots?.length > 0) {
      event.timeSlots.forEach(s => {
        slotMap[s._id.toString()] = { label: s.label, employees: 0, walkIns: 0 };
      });
      bookings.forEach(b => {
        if (b.timeSlot && slotMap[b.timeSlot.toString()]) {
          slotMap[b.timeSlot.toString()].employees++;
        }
      });
      walkIns.forEach(w => {
        if (w.timeSlot && slotMap[w.timeSlot.toString()]) {
          slotMap[w.timeSlot.toString()].walkIns++;
        }
      });
    }
    const slotBreakdown = Object.values(slotMap);

    // Hourly check-in timeline
    const timeline = {};
    bookings.filter(b => b.status === 'checked_in' && b.checkedInAt).forEach(b => {
      const hour = new Date(b.checkedInAt).getHours();
      const key = `${hour.toString().padStart(2, '0')}:00`;
      timeline[key] = (timeline[key] || { employees: 0, walkIns: 0 });
      timeline[key].employees++;
    });
    walkIns.forEach(w => {
      const hour = new Date(w.checkedInAt).getHours();
      const key = `${hour.toString().padStart(2, '0')}:00`;
      timeline[key] = (timeline[key] || { employees: 0, walkIns: 0 });
      timeline[key].walkIns++;
    });
    const checkInTimeline = Object.entries(timeline)
      .map(([hour, counts]) => ({ hour, ...counts, total: counts.employees + counts.walkIns }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    res.json({
      event,
      classification,
      totalAttendees,
      foodBreakdown,
      slotBreakdown,
      checkInTimeline,
      bookings,
      walkIns,
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/events/:eventId/report/download - download CSV report
router.get('/events/:eventId/report/download', protect, adminOnly, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const bookings = await Booking.find({
      event: req.params.eventId,
      status: { $ne: 'cancelled' },
    })
      .populate('employee', 'name employeeId email department phone')
      .lean();

    const walkIns = await WalkIn.find({ event: req.params.eventId })
      .populate('checkedInBy', 'name employeeId')
      .lean();

    const hasSlots = event.timeSlots?.length > 0;
    const headers = [
      'Type', 'Name', 'Employee ID', 'Email', 'Phone', 'Department',
      ...(hasSlots ? ['Time Slot'] : []),
      'Food Preference', 'Status', 'Checked In At', 'Notes',
    ];

    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [];

    bookings.forEach(b => {
      rows.push([
        'Employee',
        b.employee?.name || '',
        b.employee?.employeeId || '',
        b.employee?.email || '',
        b.employee?.phone || '',
        b.employee?.department || '',
        ...(hasSlots ? [b.timeSlotLabel || ''] : []),
        b.foodPreference || '',
        b.status === 'checked_in' ? 'Checked In' : 'Confirmed',
        b.checkedInAt ? new Date(b.checkedInAt).toLocaleString() : '',
        '',
      ].map(escapeCSV));
    });

    walkIns.forEach(w => {
      const typeLabels = {
        guest: 'Guest',
        staff: 'Staff',
        housekeeping: 'Housekeeping',
        unregistered_employee: 'Unregistered Employee',
      };
      rows.push([
        typeLabels[w.attendeeType] || w.attendeeType,
        w.name || '',
        w.employeeId || '',
        w.email || '',
        w.phone || '',
        w.department || '',
        ...(hasSlots ? [w.timeSlotLabel || ''] : []),
        w.foodPreference || '',
        'Walk-in',
        w.checkedInAt ? new Date(w.checkedInAt).toLocaleString() : '',
        w.notes || '',
      ].map(escapeCSV));
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_report.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/employees - list all employees
router.get('/employees', protect, adminOnly, [
  query('role').optional().isIn(['employee', 'admin', 'volunteer']).withMessage('Invalid role filter'),
], handleValidationErrors, async (req, res) => {
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
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// PATCH /api/admin/employees/:id/role - change employee role
router.patch('/employees/:id/role', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid employee ID'),
  body('role').isIn(['employee', 'admin', 'volunteer']).withMessage('Invalid role'),
], handleValidationErrors, async (req, res) => {
  try {
    const { role } = req.body;

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
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/role-users - list all role users (admins/volunteers)
router.get('/role-users', protect, adminOnly, async (req, res) => {
  try {
    const roleUsers = await RoleUser.find().sort({ role: 1, email: 1 });
    res.json({ roleUsers });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/admin/role-users - add a role user
router.post('/role-users', protect, adminOnly, [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('role').isIn(['admin', 'volunteer']).withMessage('Role must be admin or volunteer'),
  body('name').optional().trim().isLength({ max: 100 }),
], handleValidationErrors, async (req, res) => {
  try {
    const { email, role, name } = req.body;

    const existing = await RoleUser.findOne({ email });
    if (existing) {
      existing.role = role;
      existing.name = name || existing.name;
      existing.isActive = true;
      await existing.save();

      // Sync the Employee record role too
      await Employee.findOneAndUpdate({ email }, { role });

      return res.json({ message: 'Role user updated', roleUser: existing });
    }

    const roleUser = await RoleUser.create({
      email,
      role,
      name: name || '',
      addedBy: req.employee.name,
    });

    // Sync the Employee record role if they exist
    await Employee.findOneAndUpdate({ email }, { role });

    res.status(201).json({ message: 'Role user added', roleUser });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This email already has a role assigned' });
    }
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// DELETE /api/admin/role-users/:id - remove a role user (revert to employee)
router.delete('/role-users/:id', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const roleUser = await RoleUser.findByIdAndDelete(req.params.id);
    if (!roleUser) {
      return res.status(404).json({ message: 'Role user not found' });
    }

    // Revert the Employee record to employee role
    await Employee.findOneAndUpdate({ email: roleUser.email }, { role: 'employee' });

    res.json({ message: 'Role user removed, reverted to employee' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
