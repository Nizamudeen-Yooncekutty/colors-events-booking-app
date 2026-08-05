const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Employee = require('../models/Employee');
const { protect, adminOrVolunteer } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { generateQRData, generateQRImage, getSlotColor, isWalkInQR } = require('../utils/qrcode');
const { sendBookingConfirmation } = require('../utils/email');

const router = express.Router();

// QR scan: 120 req / 1 min per IP — volunteers scan rapidly during check-in
const isLoadTest = process.env.LOAD_TEST === 'true';
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isLoadTest ? 100000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many scan attempts, please slow down' },
});

// POST /api/bookings - register for an event
router.post('/', protect, [
  body('eventId').isMongoId().withMessage('Invalid event ID'),
  body('foodPreference').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Food preference is required (max 100 chars)'),
  body('timeSlotId').optional().isMongoId().withMessage('Invalid time slot ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const { eventId, foodPreference, timeSlotId } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Event is not open for registration' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const regStart = new Date(event.registrationStart);
    const regStartDate = new Date(regStart.getFullYear(), regStart.getMonth(), regStart.getDate());
    const regEnd = new Date(event.registrationEnd);
    const regEndDate = new Date(regEnd.getFullYear(), regEnd.getMonth(), regEnd.getDate());

    if (today < regStartDate || today > regEndDate) {
      return res.status(400).json({ message: 'Registration period is closed' });
    }

    // Validate time slot if event has slots
    let selectedSlot = null;
    if (event.timeSlots.length > 0) {
      if (!timeSlotId) {
        return res.status(400).json({ message: 'Please select a time slot' });
      }
      selectedSlot = event.timeSlots.id(timeSlotId);
      if (!selectedSlot) {
        return res.status(400).json({ message: 'Invalid time slot' });
      }

      // Check per-slot capacity
      if (selectedSlot.maxCapacity > 0) {
        const slotCount = await Booking.countDocuments({
          event: eventId,
          timeSlot: timeSlotId,
          status: { $ne: 'cancelled' },
        });
        if (slotCount >= selectedSlot.maxCapacity) {
          return res.status(400).json({ message: `The "${selectedSlot.label}" slot is fully booked` });
        }
      }
    }

    // Check overall capacity
    if (event.maxCapacity > 0) {
      const currentCount = await Booking.countDocuments({
        event: eventId,
        status: { $ne: 'cancelled' },
      });
      if (currentCount >= event.maxCapacity) {
        return res.status(400).json({ message: 'Event is fully booked' });
      }
    }

    // Check duplicate
    const existing = await Booking.findOne({
      employee: req.employee._id,
      event: eventId,
      status: { $ne: 'cancelled' },
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already registered for this event' });
    }

    // Validate food preference against event options
    if (event.foodOptions.length > 0) {
      const validOptions = event.foodOptions.map(o => o.name);
      if (!validOptions.includes(foodPreference)) {
        return res.status(400).json({
          message: `Invalid food preference. Choose from: ${validOptions.join(', ')}`,
        });
      }
    }

    // Generate QR with slot-specific color
    const slotIndex = selectedSlot
      ? event.timeSlots.findIndex(s => s._id.toString() === selectedSlot._id.toString())
      : null;
    const slotColor = selectedSlot ? getSlotColor(slotIndex) : null;

    const tempId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const qrData = generateQRData(tempId, req.employee.employeeId, eventId);
    const qrCode = await generateQRImage(qrData, slotIndex);

    const booking = await Booking.create({
      employee: req.employee._id,
      event: eventId,
      timeSlot: selectedSlot ? selectedSlot._id : null,
      timeSlotLabel: selectedSlot ? selectedSlot.label : '',
      slotColor: slotColor ? slotColor.dark : '',
      foodPreference,
      qrCode,
      qrData,
    });

    const populated = await booking.populate([
      { path: 'employee', select: 'name employeeId email department' },
      { path: 'event', select: 'title eventDate venue' },
    ]);

    // Send confirmation email (non-blocking)
    sendBookingConfirmation(req.employee, event, booking);

    res.status(201).json({ booking: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already registered for this event' });
    }
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/bookings/my - get current user's bookings
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ employee: req.employee._id })
      .populate('event', 'title eventDate venue status')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/bookings/:id - get single booking with QR
router.get('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid booking ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('employee', 'name employeeId email department')
      .populate('event', 'title eventDate venue status timeSlots');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only allow own booking or admin/volunteer
    if (
      booking.employee._id.toString() !== req.employee._id.toString() &&
      !['admin', 'volunteer'].includes(req.employee.role)
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// DELETE /api/bookings/:id - cancel booking
router.delete('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid booking ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (
      booking.employee.toString() !== req.employee._id.toString() &&
      req.employee.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (booking.status === 'checked_in') {
      return res.status(400).json({ message: 'Cannot cancel after check-in' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/bookings/scan - scan QR to check in (admin/volunteer only)
router.post('/scan', protect, adminOrVolunteer, scanLimiter, [
  body('qrData').isString().trim().isLength({ min: 1, max: 500 }).withMessage('QR data is required (max 500 chars)'),
], handleValidationErrors, async (req, res) => {
  try {
    const { qrData } = req.body;

    if (isWalkInQR(qrData)) {
      return res.status(400).json({
        message: 'walk_in_qr',
        isWalkInQR: true,
        qrData,
      });
    }

    const booking = await Booking.findOne({ qrData })
      .populate('employee', 'name employeeId email department phone')
      .populate('event', 'title eventDate venue timeSlots');

    if (!booking) {
      return res.status(404).json({ message: 'Invalid QR code', valid: false });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        message: 'This booking has been cancelled',
        valid: false,
        booking,
      });
    }

    if (booking.status === 'checked_in') {
      return res.status(400).json({
        message: `Already checked in at ${new Date(booking.checkedInAt).toLocaleTimeString()}`,
        valid: false,
        booking,
      });
    }

    // Check in
    booking.status = 'checked_in';
    booking.checkedInAt = new Date();
    booking.checkedInBy = req.employee._id;
    await booking.save();

    res.json({
      message: 'Check-in successful!',
      valid: true,
      booking,
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/bookings/lookup - lookup by employee ID for fallback check-in
router.post('/lookup', protect, adminOrVolunteer, [
  body('employeeId').isString().trim().isLength({ min: 1, max: 20 }).isAlphanumeric().withMessage('Employee ID must be alphanumeric (max 20 chars)'),
], handleValidationErrors, async (req, res) => {
  try {
    const { employeeId, eventId } = req.body;

    const employee = await Employee.findOne({
      employeeId: employeeId.trim().toUpperCase(),
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const filter = { employee: employee._id, status: { $ne: 'cancelled' } };
    if (eventId) filter.event = eventId;

    const bookings = await Booking.find(filter)
      .populate('employee', 'name employeeId email department phone')
      .populate('event', 'title eventDate venue status timeSlots')
      .sort({ createdAt: -1 });

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'No active bookings found for this employee' });
    }

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
