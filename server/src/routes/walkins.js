const express = require('express');
const mongoose = require('mongoose');
const { body, param } = require('express-validator');
const WalkIn = require('../models/WalkIn');
const Event = require('../models/Event');
const Employee = require('../models/Employee');
const Booking = require('../models/Booking');
const { protect, adminOrVolunteer, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { getSlotColor, generateWalkInQRData, generateWalkInQRImage, isWalkInQR, parseWalkInQR, WALKIN_TYPE_COLORS } = require('../utils/qrcode');
const { parsePagination, paginationMeta } = require('../utils/paginate');

const router = express.Router();

const TYPE_LABELS = {
  guest: 'Guest',
  staff: 'Staff',
  housekeeping: 'Housekeeping',
  unregistered_employee: 'Unregistered Employee',
};

// POST /api/walkins - register and check in a walk-in (manual form or QR-based)
router.post('/', protect, adminOrVolunteer, [
  body('eventId').isMongoId().withMessage('Invalid event ID'),
  body('attendeeType').isIn(['guest', 'staff', 'housekeeping', 'unregistered_employee']).withMessage('Invalid attendee type'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone must be at most 20 characters'),
  body('email').optional().trim().custom((value) => {
    if (value && value.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
      }
    }
    return true;
  }),
  body('department').optional().trim().isLength({ max: 100 }).withMessage('Department must be at most 100 characters'),
  body('employeeId').optional().trim().custom((value) => {
    if (value && value.length > 0) {
      if (!/^[a-zA-Z0-9]+$/.test(value)) throw new Error('Employee ID must be alphanumeric');
      if (value.length > 20) throw new Error('Employee ID must be at most 20 characters');
    }
    return true;
  }),
  body('foodPreference').optional().trim().isLength({ max: 100 }).withMessage('Food preference must be under 100 characters'),
  body('timeSlotId').optional().custom((value) => {
    if (value && value.length > 0) {
      if (!/^[a-f0-9]{24}$/.test(value)) throw new Error('Invalid time slot ID');
    }
    return true;
  }),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be at most 500 characters'),
], handleValidationErrors, async (req, res) => {
  try {
    const { eventId, name, phone, email, attendeeType, department, employeeId, foodPreference, timeSlotId, notes } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Walk-in registration is not allowed for closed or inactive events' });
    }

    // Validate unregistered_employee walk-in: require employee ID and prevent duplicates
    if (attendeeType === 'unregistered_employee') {
      if (!employeeId || employeeId.trim().length === 0) {
        return res.status(400).json({ message: 'Employee ID is required for unregistered employee walk-in' });
      }

      // Prevent duplicate walk-in for the same employee at the same event
      const duplicateWalkIn = await WalkIn.findOne({
        event: eventId,
        employeeId: employeeId.toUpperCase(),
        attendeeType: 'unregistered_employee',
      });
      if (duplicateWalkIn) {
        return res.status(409).json({ message: 'This employee has already been registered as a walk-in for this event' });
      }

      // Check if employee already has a booking (QR check-in) for this event
      const registeredEmployee = await Employee.findOne({ employeeId: employeeId.toUpperCase() });
      if (registeredEmployee) {
        const existingBooking = await Booking.findOne({
          employee: registeredEmployee._id,
          event: eventId,
          status: { $ne: 'cancelled' },
        });
        if (existingBooking) {
          return res.status(409).json({ message: 'This employee already has a booking for this event. Walk-in registration is not allowed.' });
        }
      }
    }

    let selectedSlot = null;
    let slotIndex = null;
    if (timeSlotId && event.timeSlots.length > 0) {
      selectedSlot = event.timeSlots.id(timeSlotId);
      if (selectedSlot) {
        slotIndex = event.timeSlots.findIndex(s => s._id.toString() === selectedSlot._id.toString());
      }
    }

    const slotColor = slotIndex != null ? getSlotColor(slotIndex) : null;

    const walkIn = await WalkIn.create({
      event: eventId,
      name: (name || TYPE_LABELS[attendeeType] || 'Walk-in').trim(),
      phone: phone || '',
      email: email || '',
      attendeeType,
      department: department || '',
      employeeId: employeeId ? employeeId.toUpperCase() : '',
      foodPreference: foodPreference || '',
      timeSlot: selectedSlot ? selectedSlot._id : null,
      timeSlotLabel: selectedSlot ? selectedSlot.label : '',
      slotColor: slotColor ? slotColor.dark : '',
      notes: notes || '',
      checkedInBy: req.employee._id,
    });

    const populated = await walkIn.populate([
      { path: 'event', select: 'title eventDate venue' },
      { path: 'checkedInBy', select: 'name employeeId' },
    ]);

    res.status(201).json({
      message: `${TYPE_LABELS[attendeeType] || 'Walk-in'} checked in successfully!`,
      walkIn: populated,
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/walkins/scan - handle walk-in QR scan (auto check-in)
router.post('/scan', protect, adminOrVolunteer, [
  body('qrData').isString().trim().isLength({ min: 1, max: 500 }).withMessage('QR data is required (max 500 chars)'),
  body('employeeId').optional().trim().custom((value) => {
    if (value && value.length > 0) {
      if (!/^[a-zA-Z0-9]+$/.test(value)) throw new Error('Employee ID must be alphanumeric');
      if (value.length > 20) throw new Error('Employee ID must be at most 20 characters');
    }
    return true;
  }),
], handleValidationErrors, async (req, res) => {
  try {
    const { qrData, name, phone, department, foodPreference, notes } = req.body;

    if (!isWalkInQR(qrData)) {
      return res.status(400).json({ message: 'Not a walk-in QR code' });
    }

    const parsed = parseWalkInQR(qrData);
    if (!parsed) {
      return res.status(400).json({ message: 'Invalid walk-in QR code' });
    }

    const event = await Event.findById(parsed.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Walk-in registration is not allowed for closed or inactive events' });
    }

    // For unregistered_employee QR scans, accept employeeId from the request body
    const { employeeId } = req.body;
    if (parsed.attendeeType === 'unregistered_employee') {
      if (!employeeId || employeeId.trim().length === 0) {
        return res.status(400).json({ message: 'Employee ID is required for unregistered employee walk-in' });
      }

      const duplicateWalkIn = await WalkIn.findOne({
        event: parsed.eventId,
        employeeId: employeeId.trim().toUpperCase(),
        attendeeType: 'unregistered_employee',
      });
      if (duplicateWalkIn) {
        return res.status(409).json({ message: 'This employee has already been registered as a walk-in for this event' });
      }

      // Check if employee already has a booking (QR check-in) for this event
      const registeredEmployee = await Employee.findOne({ employeeId: employeeId.trim().toUpperCase() });
      if (registeredEmployee) {
        const existingBooking = await Booking.findOne({
          employee: registeredEmployee._id,
          event: parsed.eventId,
          status: { $ne: 'cancelled' },
        });
        if (existingBooking) {
          return res.status(409).json({ message: 'This employee already has a booking for this event. Walk-in registration is not allowed.' });
        }
      }
    }

    const walkIn = await WalkIn.create({
      event: parsed.eventId,
      name: (name || TYPE_LABELS[parsed.attendeeType] || 'Walk-in').trim(),
      phone: phone || '',
      attendeeType: parsed.attendeeType,
      department: department || '',
      employeeId: employeeId ? employeeId.trim().toUpperCase() : '',
      foodPreference: foodPreference || '',
      notes: notes || '',
      checkedInBy: req.employee._id,
    });

    const populated = await walkIn.populate([
      { path: 'event', select: 'title eventDate venue' },
      { path: 'checkedInBy', select: 'name employeeId' },
    ]);

    // Get live count for this type at this event
    const typeCount = await WalkIn.countDocuments({
      event: parsed.eventId,
      attendeeType: parsed.attendeeType,
    });

    res.status(201).json({
      message: `${TYPE_LABELS[parsed.attendeeType] || 'Walk-in'} checked in successfully!`,
      walkIn: populated,
      typeCount,
      attendeeType: parsed.attendeeType,
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/walkins/event/:eventId/qrcodes - get pre-generated QR codes for an event
router.get('/event/:eventId/qrcodes', protect, adminOrVolunteer, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).select('title eventDate venue status');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const types = ['guest', 'staff', 'housekeeping', 'unregistered_employee'];
    const qrCodes = [];

    for (const type of types) {
      const qrData = generateWalkInQRData(req.params.eventId, type);
      const qrImage = await generateWalkInQRImage(qrData, type);
      const count = await WalkIn.countDocuments({
        event: req.params.eventId,
        attendeeType: type,
      });

      qrCodes.push({
        type,
        label: TYPE_LABELS[type],
        qrData,
        qrImage,
        color: WALKIN_TYPE_COLORS[type],
        count,
      });
    }

    res.json({ event, qrCodes });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/walkins/event/:eventId - list walk-ins for an event
router.get('/event/:eventId', protect, adminOrVolunteer, [
  param('eventId').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = { event: new mongoose.Types.ObjectId(req.params.eventId) };

    if (type) filter.attendeeType = type;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { employeeId: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Stats from full filtered set (before pagination)
    const statsAgg = await WalkIn.aggregate([
      { $match: filter },
      { $group: { _id: '$attendeeType', count: { $sum: 1 } } },
    ]);
    const stats = { total: 0, guest: 0, staff: 0, housekeeping: 0, unregisteredEmployee: 0 };
    const typeKeyMap = { guest: 'guest', staff: 'staff', housekeeping: 'housekeeping', unregistered_employee: 'unregisteredEmployee' };
    statsAgg.forEach(s => {
      stats.total += s.count;
      const key = typeKeyMap[s._id];
      if (key) stats[key] = s.count;
    });

    const { page, limit, skip } = parsePagination(req.query);

    const walkIns = await WalkIn.find(filter)
      .populate('checkedInBy', 'name employeeId')
      .populate('event', 'title eventDate venue')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ walkIns, stats, pagination: paginationMeta(stats.total, page, limit) });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
