const express = require('express');
const mongoose = require('mongoose');
const { body, param, query } = require('express-validator');
const Employee = require('../models/Employee');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const WalkIn = require('../models/WalkIn');
const RoleUser = require('../models/RoleUser');
const AllowedEmployee = require('../models/AllowedEmployee');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { generateQRData, generateQRImage, getSlotColor } = require('../utils/qrcode');
const { sendBookingConfirmation } = require('../utils/email');
const { parsePagination, paginationMeta } = require('../utils/paginate');

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

    const { page, limit, skip } = parsePagination(req.query);

    const eventFilter = {};
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      eventFilter.$or = [
        { title: searchRegex },
        { venue: searchRegex },
        { location: searchRegex },
      ];
    }

    const eventsTotal = await Event.countDocuments(eventFilter);

    const events = await Event.find(eventFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    for (const event of events) {
      event.bookingCount = await Booking.countDocuments({
        event: event._id,
        status: { $ne: 'cancelled' },
      });
      event.checkedInCount = await Booking.countDocuments({
        event: event._id,
        status: 'checked_in',
      });
      const eventWalkIns = await WalkIn.aggregate([
        { $match: { event: event._id } },
        { $group: { _id: '$attendeeType', count: { $sum: 1 } } },
      ]);
      event.walkInCount = eventWalkIns.reduce((sum, w) => sum + w.count, 0);
      event.walkInBreakdown = { guest: 0, staff: 0, housekeeping: 0, unregistered_employee: 0 };
      eventWalkIns.forEach(w => { event.walkInBreakdown[w._id] = w.count; });
      event.totalAttended = event.checkedInCount + event.walkInCount;
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
      events,
      pagination: paginationMeta(eventsTotal, page, limit),
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
  query('food').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('Invalid food filter'),
  query('slot').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid slot filter'),
  query('search').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('Search must be under 100 characters'),
  query('location').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }).withMessage('Invalid location filter'),
], handleValidationErrors, async (req, res) => {
  try {
    const { status, food, search, slot, location } = req.query;
    const eventObjectId = new mongoose.Types.ObjectId(req.params.eventId);
    const filter = { event: eventObjectId };

    if (status) filter.status = status;
    if (food) filter.foodPreference = food;
    if (slot) filter.timeSlot = new mongoose.Types.ObjectId(slot);
    if (location) filter.location = new RegExp(`^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    // Search by employee fields using a lookup pipeline
    let employeeIds = null;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchedEmployees = await Employee.find({
        $or: [
          { name: searchRegex },
          { employeeId: searchRegex },
          { email: searchRegex },
        ],
      }).select('_id');
      employeeIds = matchedEmployees.map(e => e._id);
      filter.employee = { $in: employeeIds };
    }

    // Stats from full filtered set (before pagination)
    const statsPipeline = [
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];
    const statsAgg = await Booking.aggregate(statsPipeline);
    const stats = { total: 0, confirmed: 0, checkedIn: 0, cancelled: 0 };
    statsAgg.forEach(s => {
      stats.total += s.count;
      if (s._id === 'confirmed') stats.confirmed = s.count;
      else if (s._id === 'checked_in') stats.checkedIn = s.count;
      else if (s._id === 'cancelled') stats.cancelled = s.count;
    });

    const { page, limit, skip } = parsePagination(req.query);

    const bookings = await Booking.find(filter)
      .populate('employee', 'name employeeId email department phone')
      .populate('event', 'title eventDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const locations = await Booking.distinct('location', { event: eventObjectId, status: { $ne: 'cancelled' }, location: { $ne: '' } });

    res.json({ bookings, stats, locations, pagination: paginationMeta(stats.total, page, limit) });
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

    // Location breakdown
    const locationMap = {};
    bookings.forEach(b => {
      const loc = b.location || 'Unknown';
      locationMap[loc] = (locationMap[loc] || { total: 0, checkedIn: 0 });
      locationMap[loc].total++;
      if (b.status === 'checked_in') locationMap[loc].checkedIn++;
    });
    walkIns.forEach(w => {
      const loc = w.location || 'Unknown';
      locationMap[loc] = (locationMap[loc] || { total: 0, checkedIn: 0 });
      locationMap[loc].total++;
      locationMap[loc].checkedIn++;
    });
    const locationBreakdown = Object.entries(locationMap)
      .map(([location, counts]) => ({ location, ...counts }))
      .sort((a, b) => b.total - a.total);

    res.json({
      event,
      classification,
      totalAttendees,
      foodBreakdown,
      slotBreakdown,
      locationBreakdown,
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

    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Summary section
    const guestCount = walkIns.filter(w => w.attendeeType === 'guest').length;
    const staffCount = walkIns.filter(w => w.attendeeType === 'staff').length;
    const housekeepingCount = walkIns.filter(w => w.attendeeType === 'housekeeping').length;
    const unregEmpCount = walkIns.filter(w => w.attendeeType === 'unregistered_employee').length;
    const checkedInCount = bookings.filter(b => b.status === 'checked_in').length;
    const totalAttended = checkedInCount + walkIns.length;

    const summaryRows = [
      ['EVENT REPORT SUMMARY'],
      ['Event', event.title],
      ['Date', new Date(event.eventDate).toLocaleDateString()],
      ['Venue', event.venue],
      ...(event.location ? [['Location', event.location]] : []),
      [''],
      ['ATTENDANCE'],
      ['Total Registrations', bookings.length],
      ['Employee Check-ins', checkedInCount],
      ['Total Walk-ins', walkIns.length],
      ['  - Guests', guestCount],
      ['  - Staff', staffCount],
      ['  - Housekeeping', housekeepingCount],
      ['  - Unregistered Employees', unregEmpCount],
      ['Total Attended', totalAttended],
      [''],
      ['DETAILED RECORDS'],
    ];

    const headers = [
      'Type', 'Attendee Category', 'Name', 'Employee ID', 'Email', 'Phone', 'Department', 'Location',
      ...(hasSlots ? ['Time Slot'] : []),
      'Food Preference', 'Status', 'Checked In At', 'Notes',
    ];

    const rows = [];

    bookings.forEach(b => {
      rows.push([
        'Employee',
        'Registered Employee',
        b.employee?.name || '',
        b.employee?.employeeId || '',
        b.employee?.email || '',
        b.employee?.phone || '',
        b.employee?.department || '',
        b.location || '',
        ...(hasSlots ? [b.timeSlotLabel || ''] : []),
        b.foodPreference || '',
        b.status === 'checked_in' ? 'Checked In' : 'Confirmed',
        b.checkedInAt ? new Date(b.checkedInAt).toLocaleString() : '',
        '',
      ].map(escapeCSV));
    });

    const typeLabels = {
      guest: 'Guest',
      staff: 'Staff',
      housekeeping: 'Housekeeping',
      unregistered_employee: 'Unregistered Employee',
    };
    walkIns.forEach(w => {
      rows.push([
        'Walk-in',
        typeLabels[w.attendeeType] || w.attendeeType,
        w.name || '',
        w.employeeId || '',
        w.email || '',
        w.phone || '',
        w.department || '',
        w.location || '',
        ...(hasSlots ? [w.timeSlotLabel || ''] : []),
        w.foodPreference || '',
        'Walk-in',
        w.checkedInAt ? new Date(w.checkedInAt).toLocaleString() : '',
        w.notes || '',
      ].map(escapeCSV));
    });

    const summaryCSV = summaryRows.map(r => r.map(escapeCSV).join(',')).join('\n');
    const dataCSV = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const csv = summaryCSV + '\n' + dataCSV;

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
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { employeeId: searchRegex },
        { email: searchRegex },
      ];
    }

    const { page, limit, skip } = parsePagination(req.query);
    const total = await Employee.countDocuments(filter);

    const employees = await Employee.find(filter)
      .select('-password')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.json({ employees, total, pagination: paginationMeta(total, page, limit) });
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

// POST /api/admin/register-employee - admin registers an employee (bypasses registration window)
router.post('/register-employee', protect, adminOnly, [
  body('eventId').isMongoId().withMessage('Invalid event ID'),
  body('employeeId').isString().trim().isLength({ min: 1, max: 20 }).isAlphanumeric().withMessage('Employee ID must be alphanumeric (max 20 chars)'),
  body('foodPreference').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Food preference is required (max 100 chars)'),
  body('timeSlotId').optional({ values: 'falsy' }).matches(/^[a-f0-9]{24}$/).withMessage('Invalid time slot ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const { eventId, foodPreference, timeSlotId } = req.body;
    const employeeId = req.body.employeeId.trim().toUpperCase();

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Event is not open for registration' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ed = new Date(event.eventDate);
    if (today > new Date(ed.getFullYear(), ed.getMonth(), ed.getDate())) {
      return res.status(400).json({ message: 'Event date has already passed' });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const existing = await Booking.findOne({ employee: employee._id, event: eventId, status: { $ne: 'cancelled' } });
    if (existing) return res.status(400).json({ message: 'This employee is already registered for this event' });

    let selectedSlot = null;
    if (event.timeSlots.length > 0) {
      if (!timeSlotId) return res.status(400).json({ message: 'Please select a time slot' });
      selectedSlot = event.timeSlots.id(timeSlotId);
      if (!selectedSlot) return res.status(400).json({ message: 'Invalid time slot' });
      if (selectedSlot.maxCapacity > 0) {
        const slotCount = await Booking.countDocuments({ event: eventId, timeSlot: timeSlotId, status: { $ne: 'cancelled' } });
        if (slotCount >= selectedSlot.maxCapacity) {
          return res.status(400).json({ message: `The "${selectedSlot.label}" slot is fully booked` });
        }
      }
    }

    if (event.maxCapacity > 0) {
      const currentCount = await Booking.countDocuments({ event: eventId, status: { $ne: 'cancelled' } });
      if (currentCount >= event.maxCapacity) {
        return res.status(400).json({ message: 'Event is fully booked' });
      }
    }

    if (event.foodOptions.length > 0) {
      const validOptions = event.foodOptions.map(o => o.name);
      if (!validOptions.includes(foodPreference)) {
        return res.status(400).json({ message: `Invalid food preference. Choose from: ${validOptions.join(', ')}` });
      }
    }

    const totalSlots = event.timeSlots.length;
    const slotIndex = selectedSlot
      ? event.timeSlots.findIndex(s => s._id.toString() === selectedSlot._id.toString())
      : null;
    const slotColor = selectedSlot ? getSlotColor(slotIndex, totalSlots) : null;
    const tempId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const qrData = generateQRData(tempId, employee.employeeId, eventId);

    const allowedEntry = await AllowedEmployee.findOne({ uid: employee.employeeId, isActive: true });
    const empLocation = allowedEntry?.location || '';

    const booking = await Booking.create({
      employee: employee._id,
      event: eventId,
      timeSlot: selectedSlot ? selectedSlot._id : null,
      timeSlotLabel: selectedSlot ? selectedSlot.label : '',
      slotColor: slotColor ? slotColor.dark : '',
      foodPreference,
      location: empLocation,
      qrCode: '',
      qrData,
    });

    const populated = await booking.populate([
      { path: 'employee', select: 'name employeeId email department' },
      { path: 'event', select: 'title eventDate venue location timeSlots' },
    ]);

    generateQRImage(qrData, slotIndex, totalSlots).then(qrCode => {
      Booking.findByIdAndUpdate(booking._id, { qrCode }).catch(() => {});
    }).catch(() => {});

    try { sendBookingConfirmation(employee, event, booking); } catch (e) { /* non-blocking */ }

    res.status(201).json({ booking: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This employee is already registered for this event' });
    }
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/events/:eventId/offline-scanner — download self-contained offline scanner HTML
router.get('/events/:eventId/offline-scanner', protect, adminOnly, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const bookings = await Booking.find({
      event: req.params.eventId,
      status: { $ne: 'cancelled' },
    }).populate('employee', 'name employeeId email department').lean();

    const walkIns = await WalkIn.find({ event: req.params.eventId }).lean();

    const data = {
      event: { title: event.title, date: event.eventDate, venue: event.venue, location: event.location },
      bookings: bookings.map(b => ({
        id: b._id,
        qrData: b.qrData,
        empId: b.employee?.employeeId || '',
        name: b.employee?.name || '',
        dept: b.employee?.department || '',
        food: b.foodPreference,
        slot: b.timeSlotLabel || '',
        location: b.location || '',
        status: b.status,
      })),
      walkIns: walkIns.map(w => ({
        id: w._id,
        empId: w.employeeId || '',
        name: w.name,
        type: w.attendeeType,
        food: w.foodPreference || '',
        location: w.location || '',
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: req.employee.name,
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>UST QPass Offline Scanner — ${event.title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;color:#1a1a1a}
.header{background:#006e74;color:#fff;padding:12px 16px;position:sticky;top:0;z-index:10}
.header h1{font-size:16px;font-weight:600}
.header p{font-size:11px;opacity:.8;margin-top:2px}
.stats{display:flex;gap:8px;padding:12px 16px;flex-wrap:wrap}
.stat{background:#fff;border-radius:8px;padding:10px 14px;flex:1;min-width:70px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);cursor:pointer}
.stat.active{border:2px solid #006e74}
.stat .num{font-size:20px;font-weight:700;color:#006e74}
.stat .label{font-size:10px;color:#666;margin-top:2px}
.tabs{display:flex;gap:4px;padding:0 16px;margin-bottom:8px}
.tab{padding:8px 16px;border-radius:20px;border:none;font-size:13px;cursor:pointer;background:#e0e0e0;font-weight:500}
.tab.active{background:#006e74;color:#fff}
.search{padding:8px 16px}
.search input,.search select{padding:10px 12px;border:2px solid #ddd;border-radius:8px;font-size:14px}
.search input:focus,.search select:focus{border-color:#006e74;outline:none}
.search input{width:100%}
.filters{display:flex;gap:8px;padding:4px 16px;flex-wrap:wrap}
.filter-btn{padding:5px 12px;border-radius:16px;border:1.5px solid #ddd;font-size:11px;cursor:pointer;background:#fff;font-weight:500}
.filter-btn.active{background:#006e74;color:#fff;border-color:#006e74}
.list{padding:8px 16px}
.card{background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);border-left:4px solid #006e74}
.card.checked{border-left-color:#22c55e;background:#f0fdf4}
.card.server-checked{border-left-color:#3b82f6;background:#eff6ff}
.card .name{font-size:14px;font-weight:600}
.card .meta{font-size:11px;color:#666;margin-top:3px}
.card .checkin-time{font-size:10px;color:#22c55e;margin-top:4px;font-weight:500}
.card .badges{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}
.badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.badge.food{background:#fef3c7;color:#92400e}
.badge.slot{background:#dbeafe;color:#1e40af}
.badge.loc{background:#e0e7ff;color:#3730a3}
.badge.checked{background:#dcfce7;color:#166534}
.badge.pending{background:#fee2e2;color:#991b1b}
.badge.server{background:#dbeafe;color:#1e40af}
.btn{width:100%;padding:10px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-top:6px}
.btn-check{background:#006e74;color:#fff}
.btn-undo{background:#fee2e2;color:#991b1b}
.scanner-area{padding:16px;text-align:center}
.scanner-result{margin-top:12px;padding:12px;border-radius:8px;font-size:13px;text-align:left}
.scanner-result.found{background:#dcfce7;color:#166534}
.scanner-result.duplicate{background:#fef3c7;color:#92400e}
.scanner-result.notfound{background:#fee2e2;color:#991b1b}
.export-btn{margin:8px 16px;padding:12px;background:#006e74;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:calc(100% - 32px)}
.offline-badge{background:#f59e0b;color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;margin-left:8px}
.count{font-size:10px;background:rgba(255,255,255,.2);padding:2px 6px;border-radius:8px;margin-left:6px}
.walkin-form{padding:16px;background:#fff;margin:8px 16px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.walkin-form input,.walkin-form select{width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:6px;font-size:13px;margin-top:4px}
.walkin-form label{font-size:11px;font-weight:600;color:#333;display:block;margin-top:8px}
.walkin-form label:first-child{margin-top:0}
.history{padding:8px 16px}
.history-item{font-size:11px;padding:6px 10px;background:#fff;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}
.history-item .time{color:#666;font-size:10px}
.toast{position:fixed;top:60px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:100;animation:fadeInOut 2s ease;pointer-events:none}
.toast.success{background:#22c55e;color:#fff}
.toast.error{background:#ef4444;color:#fff}
.toast.warn{background:#f59e0b;color:#fff}
@keyframes fadeInOut{0%{opacity:0;transform:translateX(-50%) translateY(-10px)}10%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0}}
.confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:50}
.confirm-box{background:#fff;border-radius:12px;padding:20px;max-width:340px;width:90%;text-align:center}
.confirm-box h3{font-size:15px;margin-bottom:4px}
.confirm-box p{font-size:12px;color:#666;margin-bottom:16px}
.confirm-box .btns{display:flex;gap:8px}
.confirm-box .btns button{flex:1;padding:10px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
</style>
</head>
<body>
<div class="header">
<h1>UST QPass <span class="offline-badge">OFFLINE</span></h1>
<p>${event.title} — ${new Date(event.eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
<p>${event.venue}${event.location ? ', ' + event.location : ''} | Exported: ${new Date().toLocaleString('en-IN')}</p>
</div>
<div id="toast"></div>
<div id="confirm"></div>
<div id="app"></div>

<script>
const DATA=${JSON.stringify(data)};
const STORE_KEY='qpass_offline_'+DATA.event.title.replace(/[^a-zA-Z0-9]/g,'_');
const checkedIn=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
const offlineWalkIns=JSON.parse(localStorage.getItem(STORE_KEY+'_walkins')||'[]');
const actionLog=JSON.parse(localStorage.getItem(STORE_KEY+'_log')||'[]');
let currentTab='scan';
let searchTerm='';
let statusFilter='all';

function save(){
localStorage.setItem(STORE_KEY,JSON.stringify(checkedIn));
localStorage.setItem(STORE_KEY+'_walkins',JSON.stringify(offlineWalkIns));
localStorage.setItem(STORE_KEY+'_log',JSON.stringify(actionLog));
}

function showToast(msg,type){
const el=document.getElementById('toast');
el.innerHTML='<div class="toast '+type+'">'+msg+'</div>';
try{navigator.vibrate&&navigator.vibrate(type==='success'?[100]:[50,50,50]);}catch(e){}
setTimeout(()=>{el.innerHTML='';},2500);
}

function showConfirm(title,detail,onYes){
const el=document.getElementById('confirm');
el.innerHTML='<div class="confirm-overlay" onclick="closeConfirm()"><div class="confirm-box" onclick="event.stopPropagation()"><h3>'+title+'</h3><p>'+detail+'</p><div class="btns"><button style="background:#e0e0e0" onclick="closeConfirm()">Cancel</button><button style="background:#006e74;color:#fff" id="confirmYes">Confirm</button></div></div></div>';
document.getElementById('confirmYes').onclick=function(){closeConfirm();onYes();};
}
function closeConfirm(){document.getElementById('confirm').innerHTML='';}

function getStats(){
const total=DATA.bookings.length;
const serverChecked=DATA.bookings.filter(b=>b.status==='checked_in').length;
const offlineChecked=DATA.bookings.filter(b=>checkedIn[b.qrData]&&b.status!=='checked_in').length;
const checked=serverChecked+offlineChecked;
return{total,checked,serverChecked,offlineChecked,pending:total-checked,walkIns:DATA.walkIns.length+offlineWalkIns.length};
}

function getCheckinTime(b){
if(checkedIn[b.qrData])return new Date(checkedIn[b.qrData]).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
if(b.status==='checked_in')return 'Before export (server)';
return null;
}

function isChecked(b){return !!(checkedIn[b.qrData]||b.status==='checked_in');}
function isServerChecked(b){return b.status==='checked_in'&&!checkedIn[b.qrData];}

function checkIn(qrData,name){
showConfirm('Check In','Confirm check-in for <strong>'+name+'</strong>?',function(){
checkedIn[qrData]=new Date().toISOString();
actionLog.unshift({type:'checkin',empId:DATA.bookings.find(b=>b.qrData===qrData)?.empId,name:name,time:new Date().toISOString()});
save();showToast('✓ '+name+' checked in','success');render();
});
}

function undoCheckIn(qrData,name){
showConfirm('Undo Check-in','Undo check-in for <strong>'+name+'</strong>?',function(){
delete checkedIn[qrData];
actionLog.unshift({type:'undo',empId:DATA.bookings.find(b=>b.qrData===qrData)?.empId,name:name,time:new Date().toISOString()});
save();showToast('↩ '+name+' check-in undone','warn');render();
});
}

function findByQR(qr){return DATA.bookings.find(b=>b.qrData===qr);}
function findByEmpId(id){return DATA.bookings.find(b=>b.empId.toUpperCase()===id.toUpperCase());}

function addOfflineWalkIn(){
const name=document.getElementById('wiName').value.trim();
const empId=document.getElementById('wiEmpId').value.trim();
const food=document.getElementById('wiFood').value;
if(!name){showToast('Name is required','error');return;}
if(empId){
const dup=offlineWalkIns.find(w=>w.empId.toUpperCase()===empId.toUpperCase());
const dupBooking=findByEmpId(empId);
if(dup){showToast('Employee '+empId+' already added as walk-in','error');return;}
if(dupBooking){showToast('Employee '+empId+' already has a booking','error');return;}
}
offlineWalkIns.push({name,empId:empId.toUpperCase(),food,time:new Date().toISOString()});
actionLog.unshift({type:'walkin',empId:empId||'—',name,time:new Date().toISOString()});
save();showToast('✓ Walk-in added: '+name,'success');
document.getElementById('wiName').value='';document.getElementById('wiEmpId').value='';
render();
}

function render(){
const s=getStats();
const filtered=DATA.bookings.filter(b=>{
if(statusFilter==='checked'&&!isChecked(b))return false;
if(statusFilter==='pending'&&isChecked(b))return false;
if(!searchTerm)return true;
const t=searchTerm.toLowerCase();
return b.empId.toLowerCase().includes(t)||b.name.toLowerCase().includes(t)||b.dept.toLowerCase().includes(t)||b.location.toLowerCase().includes(t);
});

let html='<div class="stats">';
html+='<div class="stat '+(statusFilter==='all'?'active':'')+'" onclick="statusFilter=\\'all\\';render()"><div class="num">'+s.total+'</div><div class="label">Total</div></div>';
html+='<div class="stat '+(statusFilter==='checked'?'active':'')+'" onclick="statusFilter=\\'checked\\';render()"><div class="num" style="color:#22c55e">'+s.checked+'</div><div class="label">Checked In</div></div>';
html+='<div class="stat '+(statusFilter==='pending'?'active':'')+'" onclick="statusFilter=\\'pending\\';render()"><div class="num" style="color:#ef4444">'+s.pending+'</div><div class="label">Pending</div></div>';
html+='<div class="stat" onclick="switchTab(\\'walkins\\')"><div class="num" style="color:#f59e0b">'+s.walkIns+'</div><div class="label">Walk-ins</div></div>';
html+='</div>';

html+='<div class="tabs">';
html+='<div class="tab '+(currentTab==='scan'?'active':'')+'" onclick="switchTab(\\'scan\\')">Check In</div>';
html+='<div class="tab '+(currentTab==='list'?'active':'')+'" onclick="switchTab(\\'list\\')">List<span class="count">'+filtered.length+'</span></div>';
html+='<div class="tab '+(currentTab==='walkins'?'active':'')+'" onclick="switchTab(\\'walkins\\')">Walk-ins<span class="count">'+s.walkIns+'</span></div>';
html+='<div class="tab '+(currentTab==='history'?'active':'')+'" onclick="switchTab(\\'history\\')">Log<span class="count">'+actionLog.length+'</span></div>';
html+='</div>';

if(currentTab==='scan'){
html+='<div class="scanner-area">';
html+='<p style="margin-bottom:12px;font-size:13px;color:#666">Enter Employee ID to check in:</p>';
html+='<input type="text" id="scanInput" placeholder="Enter Employee ID and press Enter" style="width:100%;max-width:400px;padding:14px;border:2px solid #006e74;border-radius:8px;font-size:18px;text-align:center" onkeydown="if(event.key===\\'Enter\\')doLookup()" autofocus>';
html+='<button onclick="doLookup()" style="margin-top:10px;padding:12px 30px;background:#006e74;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;max-width:400px">Look Up & Check In</button>';
html+='<div id="scanResult"></div>';
html+='<div id="scanHistory" style="margin-top:16px;text-align:left;max-width:400px;margin-left:auto;margin-right:auto"></div>';
html+='</div>';
renderScanHistory();
}

if(currentTab==='list'){
html+='<div class="search"><input type="text" placeholder="Search by ID, Name, Department, Location..." value="'+searchTerm+'" oninput="searchTerm=this.value;render()"></div>';
html+='<div class="list">';
filtered.forEach(b=>{
const chk=isChecked(b);
const srvChk=isServerChecked(b);
const time=getCheckinTime(b);
html+='<div class="card '+(srvChk?'server-checked':chk?'checked':'')+'">';
html+='<div class="name">'+b.empId+' — '+b.name+'</div>';
html+='<div class="meta">'+b.dept+'</div>';
if(time)html+='<div class="checkin-time">'+(srvChk?'🔵':'✅')+' Checked in: '+time+'</div>';
html+='<div class="badges">';
if(b.food)html+='<span class="badge food">'+b.food+'</span>';
if(b.slot)html+='<span class="badge slot">'+b.slot+'</span>';
if(b.location)html+='<span class="badge loc">'+b.location+'</span>';
if(srvChk)html+='<span class="badge server">Server Check-in</span>';
else if(chk)html+='<span class="badge checked">Checked In (Offline)</span>';
else html+='<span class="badge pending">Pending</span>';
html+='</div>';
if(srvChk)html+='<div style="font-size:11px;color:#3b82f6;margin-top:6px">Already checked in on server before export</div>';
else if(!chk)html+='<button class="btn btn-check" onclick="checkIn(\\''+b.qrData+'\\',\\''+b.name.replace(/'/g,"\\\\'")+'\\')">Check In</button>';
else html+='<button class="btn btn-undo" onclick="undoCheckIn(\\''+b.qrData+'\\',\\''+b.name.replace(/'/g,"\\\\'")+'\\')">Undo Check-in</button>';
html+='</div>';
});
if(filtered.length===0)html+='<p style="text-align:center;color:#999;padding:40px">'+(searchTerm?'No results for "'+searchTerm+'"':'No employees in this filter')+'</p>';
html+='</div>';
}

if(currentTab==='walkins'){
const foodOpts=${JSON.stringify((event.foodOptions||[]).map(f=>f.name))};
html+='<div class="walkin-form"><h3 style="font-size:14px;margin-bottom:8px">Add Walk-in (Offline)</h3>';
html+='<label>Name *</label><input id="wiName" placeholder="Full name">';
html+='<label>Employee ID</label><input id="wiEmpId" placeholder="Optional">';
html+='<label>Food Preference</label><select id="wiFood"><option value="">Select...</option>';
foodOpts.forEach(f=>{html+='<option value="'+f+'">'+f+'</option>';});
html+='</select>';
html+='<button class="btn btn-check" style="margin-top:12px" onclick="addOfflineWalkIn()">Add Walk-in</button>';
html+='</div>';
html+='<div class="list" style="margin-top:8px">';
if(offlineWalkIns.length>0){
html+='<p style="font-size:12px;font-weight:600;color:#666;margin-bottom:6px">Offline Walk-ins ('+offlineWalkIns.length+')</p>';
offlineWalkIns.forEach(w=>{
html+='<div class="card" style="border-left-color:#f59e0b"><div class="name">'+(w.empId||'—')+' — '+w.name+'</div>';
html+='<div class="meta">'+new Date(w.time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+'</div>';
html+='<div class="badges">';
if(w.food)html+='<span class="badge food">'+w.food+'</span>';
html+='<span class="badge" style="background:#fed7aa;color:#9a3412">Offline Walk-in</span>';
html+='</div></div>';
});
}
if(DATA.walkIns.length>0){
html+='<p style="font-size:12px;font-weight:600;color:#666;margin:12px 0 6px">Server Walk-ins ('+DATA.walkIns.length+')</p>';
DATA.walkIns.forEach(w=>{
html+='<div class="card"><div class="name">'+(w.empId||'—')+' — '+w.name+'</div>';
html+='<div class="badges"><span class="badge" style="background:#fed7aa;color:#9a3412">'+w.type.replace(/_/g,' ')+'</span>';
if(w.food)html+='<span class="badge food">'+w.food+'</span>';
if(w.location)html+='<span class="badge loc">'+w.location+'</span>';
html+='</div></div>';
});
}
if(DATA.walkIns.length===0&&offlineWalkIns.length===0)html+='<p style="text-align:center;color:#999;padding:40px">No walk-ins</p>';
html+='</div>';
}

if(currentTab==='history'){
html+='<div class="history">';
if(actionLog.length===0)html+='<p style="text-align:center;color:#999;padding:40px">No actions yet</p>';
actionLog.forEach(a=>{
const icon=a.type==='checkin'?'✅':a.type==='undo'?'↩':'👤';
html+='<div class="history-item"><span>'+icon+' <strong>'+a.empId+'</strong> '+a.name+'</span><span class="time">'+new Date(a.time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</span></div>';
});
html+='</div>';
}

html+='<button class="export-btn" onclick="exportData()">Export All Data (CSV)</button>';
html+='<button class="export-btn" style="background:#666;margin-top:0" onclick="if(confirm(\\'Clear all offline check-in data?\\')){localStorage.removeItem(STORE_KEY);localStorage.removeItem(STORE_KEY+\\'_walkins\\');localStorage.removeItem(STORE_KEY+\\'_log\\');location.reload();}">Reset Offline Data</button>';
html+='<p style="text-align:center;font-size:10px;color:#999;padding:8px 16px 16px">Exported by '+DATA.exportedBy+' on '+new Date(DATA.exportedAt).toLocaleString('en-IN')+'</p>';
document.getElementById('app').innerHTML=html;
}

function renderScanHistory(){
const el=document.getElementById('scanHistory');
if(!el||actionLog.length===0)return;
let h='<p style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px">Recent Check-ins</p>';
actionLog.filter(a=>a.type==='checkin').slice(0,5).forEach(a=>{
h+='<div class="history-item"><span>✅ '+a.empId+' — '+a.name+'</span><span class="time">'+new Date(a.time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+'</span></div>';
});
el.innerHTML=h;
}

function switchTab(t){currentTab=t;render();if(t==='scan')setTimeout(()=>{const i=document.getElementById('scanInput');if(i)i.focus();},100);}

function doLookup(){
const input=document.getElementById('scanInput');
const val=input.value.trim();
if(!val){showToast('Enter an Employee ID','error');return;}
const b=findByEmpId(val)||findByQR(val);
const el=document.getElementById('scanResult');

if(b){
const chk=isChecked(b);
const srvChk=isServerChecked(b);
if(srvChk){
el.innerHTML='<div class="scanner-result duplicate">⚠️ <strong>'+b.name+'</strong> ('+b.empId+') was already checked in on the server before this export.<br>Food: '+b.food+(b.slot?' | Slot: '+b.slot:'')+'</div>';
showToast(b.name+' — already on server','warn');
}else if(chk){
const time=new Date(checkedIn[b.qrData]).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
el.innerHTML='<div class="scanner-result duplicate">⚠️ <strong>'+b.name+'</strong> ('+b.empId+') already checked in at '+time+'.<br>Duplicate entry prevented.<br>Food: '+b.food+(b.slot?' | Slot: '+b.slot:'')+'</div>';
showToast(b.name+' — duplicate!','warn');
}else{
checkedIn[b.qrData]=new Date().toISOString();
actionLog.unshift({type:'checkin',empId:b.empId,name:b.name,time:new Date().toISOString()});
save();
el.innerHTML='<div class="scanner-result found">✅ <strong>'+b.name+'</strong> ('+b.empId+') checked in successfully!<br>Food: '+b.food+(b.slot?' | Slot: '+b.slot:'')+(b.location?' | Location: '+b.location:'')+'</div>';
showToast('✓ '+b.name+' checked in','success');
}
}else{
const dupWalkIn=offlineWalkIns.find(w=>w.empId===val.toUpperCase());
if(dupWalkIn){
el.innerHTML='<div class="scanner-result duplicate">⚠️ <strong>'+val.toUpperCase()+'</strong> already added as offline walk-in ('+dupWalkIn.name+').</div>';
showToast('Already a walk-in','warn');
}else{
el.innerHTML='<div class="scanner-result notfound">❌ Employee ID <strong>'+val+'</strong> not found in registrations.<br>This employee did not register for this event. Use the Walk-ins tab to add them manually.</div>';
showToast('Not found: '+val,'error');
}
}
input.value='';input.focus();
render();
renderScanHistory();
}

function exportData(){
let csv='Type,Employee ID,Name,Department,Food,Slot,Location,Status,Checked In At\\n';
DATA.bookings.forEach(b=>{
const chk=isChecked(b);
const srvChk=isServerChecked(b);
const status=srvChk?'Checked In (Server)':chk?'Checked In (Offline)':'Pending';
const time=checkedIn[b.qrData]||'';
csv+='Booking,'+b.empId+','+b.name.replace(/,/g,' ')+','+b.dept.replace(/,/g,' ')+','+b.food+','+(b.slot||'')+','+(b.location||'')+','+status+','+time+'\\n';
});
offlineWalkIns.forEach(w=>{
csv+='Walk-in (Offline),'+(w.empId||'')+','+w.name.replace(/,/g,' ')+',,'+w.food+',,,,'+w.time+'\\n';
});
DATA.walkIns.forEach(w=>{
csv+='Walk-in (Server),'+(w.empId||'')+','+w.name.replace(/,/g,' ')+',,'+w.food+',,'+w.location+',Checked In,\\n';
});
const blob=new Blob([csv],{type:'text/csv'});
const a=document.createElement('a');
a.href=URL.createObjectURL(blob);
a.download='QPass-CheckIn-'+DATA.event.title.replace(/[^a-zA-Z0-9]/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.csv';
a.click();
showToast('CSV exported','success');
}

render();
<\/script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="QPass-Offline-Scanner-${event.title.replace(/[^a-zA-Z0-9]/g, '-')}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/admin/events/:eventId/import-offline — import offline check-in CSV data back to DB
router.post('/events/:eventId/import-offline', protect, adminOnly, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
  body('checkins').isArray().withMessage('checkins must be an array'),
  body('walkins').optional().isArray().withMessage('walkins must be an array'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { checkins, walkins } = req.body;
    let checkedIn = 0;
    let alreadyCheckedIn = 0;
    let notFound = 0;
    let walkInsAdded = 0;
    let walkInsDuplicate = 0;
    const errors = [];

    for (const c of checkins) {
      try {
        if (!c.employeeId) continue;
        const employee = await Employee.findOne({ employeeId: c.employeeId.toUpperCase() });
        if (!employee) { notFound++; errors.push({ empId: c.employeeId, error: 'Employee not found' }); continue; }

        const booking = await Booking.findOne({
          employee: employee._id,
          event: req.params.eventId,
          status: { $ne: 'cancelled' },
        });
        if (!booking) { notFound++; errors.push({ empId: c.employeeId, error: 'No booking found' }); continue; }

        if (booking.status === 'checked_in') { alreadyCheckedIn++; continue; }

        booking.status = 'checked_in';
        booking.checkedInAt = c.checkedInAt ? new Date(c.checkedInAt) : new Date();
        booking.checkedInBy = req.employee._id;
        await booking.save();
        checkedIn++;
      } catch (e) {
        errors.push({ empId: c.employeeId, error: e.message });
      }
    }

    if (walkins && walkins.length > 0) {
      for (const w of walkins) {
        try {
          if (!w.name) continue;
          if (w.employeeId) {
            const dup = await WalkIn.findOne({
              event: req.params.eventId,
              employeeId: w.employeeId.toUpperCase(),
              attendeeType: 'unregistered_employee',
            });
            if (dup) { walkInsDuplicate++; continue; }
          }
          await WalkIn.create({
            event: req.params.eventId,
            name: w.name,
            employeeId: w.employeeId ? w.employeeId.toUpperCase() : '',
            attendeeType: 'unregistered_employee',
            foodPreference: w.food || '',
            checkedInBy: req.employee._id,
          });
          walkInsAdded++;
        } catch (e) {
          errors.push({ name: w.name, error: e.message });
        }
      }
    }

    res.json({
      message: 'Offline data imported successfully',
      results: {
        checkedIn,
        alreadyCheckedIn,
        notFound,
        walkInsAdded,
        walkInsDuplicate,
        errors: errors.length,
        errorDetails: errors.slice(0, 20),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
