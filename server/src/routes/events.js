const express = require('express');
const { body, param } = require('express-validator');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { parsePagination, paginationMeta } = require('../utils/paginate');

const router = express.Router();

const eventValidationRules = [
  body('title').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Title must be 2-200 characters'),
  body('description').optional().isString().trim().isLength({ max: 5000 }).withMessage('Description must be under 5000 characters'),
  body('eventDate').isISO8601().withMessage('Event date must be a valid ISO 8601 date'),
  body('venue').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Venue must be 2-200 characters'),
  body('location').optional().isString().trim().isLength({ max: 300 }).withMessage('Location must be under 300 characters'),
  body('registrationStart').isISO8601().withMessage('Registration start must be a valid ISO 8601 date'),
  body('registrationEnd').isISO8601().withMessage('Registration end must be a valid ISO 8601 date'),
  body('maxCapacity').optional().isInt({ min: 0 }).withMessage('Max capacity must be a non-negative integer'),
  body('status').optional().isIn(['draft', 'active', 'closed', 'completed']).withMessage('Status must be draft, active, closed, or completed'),
  body('timeSlots').optional().isArray({ max: 50 }).withMessage('Time slots must be an array (max 50)'),
  body('timeSlots.*.label').optional().isString().trim().isLength({ max: 100 }).withMessage('Slot label must be under 100 characters'),
  body('timeSlots.*.maxCapacity').optional().isInt({ min: 0 }).withMessage('Slot capacity must be a non-negative integer'),
  body('foodOptions').optional().isArray({ max: 50 }).withMessage('Food options must be an array (max 50)'),
  body('foodOptions.*.name').optional().isString().trim().isLength({ max: 100 }).withMessage('Food option name must be under 100 characters'),
];

function computeEventStatus(event, bookingCount) {
  if (event.maxCapacity > 0 && bookingCount >= event.maxCapacity) return 'full';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(event.registrationStart);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(event.registrationEnd);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'closed';
  return 'open';
}

// GET /api/events - list active events with server-side status filtering
router.get('/', protect, async (req, res) => {
  try {
    const baseFilter = { status: 'active' };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      baseFilter.$or = [
        { title: searchRegex },
        { venue: searchRegex },
        { location: searchRegex },
        { description: searchRegex },
      ];
    }

    const allEvents = await Event.find(baseFilter)
      .select('registrationStart registrationEnd maxCapacity')
      .lean();

    const allBookingCounts = await Booking.aggregate([
      { $match: { event: { $in: allEvents.map(e => e._id) }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$event', count: { $sum: 1 } } },
    ]);
    const bcMap = {};
    allBookingCounts.forEach(b => { bcMap[b._id.toString()] = b.count; });

    const filterCounts = { all: allEvents.length, open: 0, upcoming: 0, closed: 0, full: 0 };
    const statusMap = {};
    allEvents.forEach(e => {
      const bc = bcMap[e._id.toString()] || 0;
      const s = computeEventStatus(e, bc);
      filterCounts[s]++;
      statusMap[e._id.toString()] = s;
    });

    const requestedStatus = req.query.filterStatus;
    let matchedIds;
    if (requestedStatus && requestedStatus !== 'all') {
      matchedIds = allEvents
        .filter(e => statusMap[e._id.toString()] === requestedStatus)
        .map(e => e._id);
    }

    const paginationFilter = { ...baseFilter };
    if (matchedIds) paginationFilter._id = { $in: matchedIds };

    const { page, limit, skip } = parsePagination(req.query);
    const total = matchedIds ? matchedIds.length : allEvents.length;

    let eventsQuery = Event.find(paginationFilter)
      .sort({ eventDate: -1 })
      .skip(skip)
      .limit(limit);

    const isAdmin = req.employee.role === 'admin';
    if (isAdmin) {
      eventsQuery = eventsQuery.populate('createdBy', 'name employeeId');
    }

    const events = await eventsQuery;

    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const bookingCount = await Booking.countDocuments({
          event: event._id,
          status: { $ne: 'cancelled' },
        });
        const obj = event.toObject();
        obj.bookingCount = bookingCount;

        if (isAdmin) {
          const checkedInCount = await Booking.countDocuments({
            event: event._id,
            status: 'checked_in',
          });
          obj.checkedInCount = checkedInCount;
        } else {
          delete obj.createdBy;
          delete obj.createdAt;
          delete obj.updatedAt;
          delete obj.__v;
        }
        return obj;
      })
    );

    res.json({ events: eventsWithCounts, pagination: paginationMeta(total, page, limit), filterCounts });
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
    const { title, description, eventDate, venue, location, registrationStart, registrationEnd, maxCapacity, status, timeSlots, foodOptions } = req.body;

    // Date validation
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evDate = new Date(eventDate);
    const regStart = new Date(registrationStart);
    const regEnd = new Date(registrationEnd);

    if (evDate < today) {
      return res.status(400).json({ message: 'Event date cannot be in the past' });
    }
    if (regStart >= regEnd) {
      return res.status(400).json({ message: 'Registration start date must be before registration end date' });
    }
    if (regEnd > evDate) {
      return res.status(400).json({ message: 'Registration end date cannot be after the event date' });
    }

    // Duplicate event detection
    const duplicate = await Event.findOne({
      title: title.trim(),
      eventDate: evDate,
      venue: venue.trim(),
      createdBy: req.employee._id,
    });
    if (duplicate) {
      return res.status(409).json({ message: 'An event with the same title, date, and venue already exists' });
    }

    const event = await Event.create({
      title,
      description,
      eventDate,
      venue,
      location,
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
    const fields = ['title', 'description', 'eventDate', 'venue', 'location', 'registrationStart', 'registrationEnd', 'maxCapacity', 'status', 'timeSlots', 'foodOptions'];
    fields.forEach(f => { if (req.body[f] !== undefined) allowed[f] = req.body[f]; });

    // Validate date consistency when date fields are being updated
    const existing = await Event.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const evDate = new Date(allowed.eventDate || existing.eventDate);
    const regStart = new Date(allowed.registrationStart || existing.registrationStart);
    const regEnd = new Date(allowed.registrationEnd || existing.registrationEnd);

    if (regStart >= regEnd) {
      return res.status(400).json({ message: 'Registration start date must be before registration end date' });
    }
    if (regEnd > evDate) {
      return res.status(400).json({ message: 'Registration end date cannot be after the event date' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      allowed,
      { new: true, runValidators: true }
    );
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
