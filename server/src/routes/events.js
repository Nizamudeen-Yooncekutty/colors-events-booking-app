const express = require('express');
const { body, param } = require('express-validator');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const eventValidationRules = [
  body('title').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Title must be 2-200 characters'),
  body('eventDate').isISO8601().withMessage('Event date must be a valid ISO 8601 date'),
  body('venue').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Venue must be 2-200 characters'),
  body('registrationStart').isISO8601().withMessage('Registration start must be a valid ISO 8601 date'),
  body('registrationEnd').isISO8601().withMessage('Registration end must be a valid ISO 8601 date'),
  body('maxCapacity').optional().isInt({ min: 0 }).withMessage('Max capacity must be a non-negative integer'),
  body('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']).withMessage('Status must be draft, active, completed, or cancelled'),
];

// GET /api/events - list active events (employees) or all events (admin)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.employee.role === 'admin'
      ? {}
      : { status: 'active' };

    const events = await Event.find(filter)
      .sort({ eventDate: 1 })
      .populate('createdBy', 'name employeeId');

    // Attach booking counts
    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const bookingCount = await Booking.countDocuments({
          event: event._id,
          status: { $ne: 'cancelled' },
        });
        const checkedInCount = await Booking.countDocuments({
          event: event._id,
          status: 'checked_in',
        });
        const obj = event.toObject();
        obj.bookingCount = bookingCount;
        obj.checkedInCount = checkedInCount;
        return obj;
      })
    );

    res.json({ events: eventsWithCounts });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/events/:id
router.get('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name employeeId');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const bookingCount = await Booking.countDocuments({
      event: event._id,
      status: { $ne: 'cancelled' },
    });
    const checkedInCount = await Booking.countDocuments({
      event: event._id,
      status: 'checked_in',
    });

    // Check if current user has a booking
    const userBooking = await Booking.findOne({
      employee: req.employee._id,
      event: event._id,
      status: { $ne: 'cancelled' },
    });

    // Food preference breakdown
    const foodBreakdown = await Booking.aggregate([
      { $match: { event: event._id, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$foodPreference', count: { $sum: 1 } } },
    ]);

    // Per-slot booking counts
    let slotCounts = {};
    if (event.timeSlots.length > 0) {
      const slotAgg = await Booking.aggregate([
        { $match: { event: event._id, status: { $ne: 'cancelled' }, timeSlot: { $ne: null } } },
        { $group: { _id: '$timeSlot', count: { $sum: 1 } } },
      ]);
      for (const s of slotAgg) {
        slotCounts[s._id.toString()] = s.count;
      }
    }

    res.json({
      event: {
        ...event.toObject(),
        bookingCount,
        checkedInCount,
        foodBreakdown,
        slotCounts,
      },
      userBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/events - create event (admin only)
router.post('/', protect, adminOnly, eventValidationRules, handleValidationErrors, async (req, res) => {
  try {
    const { title, description, eventDate, venue, registrationStart, registrationEnd, maxCapacity, status, timeSlots, foodOptions } = req.body;
    const event = await Event.create({
      title,
      description,
      eventDate,
      venue,
      registrationStart,
      registrationEnd,
      maxCapacity,
      status,
      timeSlots,
      foodOptions,
      createdBy: req.employee._id,
    });
    res.status(201).json({ event });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// PUT /api/events/:id - update event (admin only)
router.put('/:id', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid event ID'),
  ...eventValidationRules.map(rule => rule.optional()),
], handleValidationErrors, async (req, res) => {
  try {
    const allowed = {};
    const fields = ['title', 'description', 'eventDate', 'venue', 'registrationStart', 'registrationEnd', 'maxCapacity', 'status', 'timeSlots', 'foodOptions'];
    fields.forEach(f => { if (req.body[f] !== undefined) allowed[f] = req.body[f]; });
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      allowed,
      { new: true, runValidators: true }
    );
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// DELETE /api/events/:id - delete event (admin only)
router.delete('/:id', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid event ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    // Also cancel all bookings for this event
    await Booking.updateMany(
      { event: event._id },
      { status: 'cancelled' }
    );
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
