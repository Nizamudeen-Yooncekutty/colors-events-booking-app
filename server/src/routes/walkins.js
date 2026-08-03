const express = require('express');
const WalkIn = require('../models/WalkIn');
const Event = require('../models/Event');
const { protect, adminOrVolunteer, adminOnly } = require('../middleware/auth');
const { getSlotColor, generateWalkInQRData, generateWalkInQRImage, isWalkInQR, parseWalkInQR, WALKIN_TYPE_COLORS } = require('../utils/qrcode');

const router = express.Router();

const TYPE_LABELS = {
  guest: 'Guest',
  staff: 'Staff',
  housekeeping: 'Housekeeping',
  unregistered_employee: 'Unregistered Employee',
};

// POST /api/walkins - register and check in a walk-in (manual form or QR-based)
router.post('/', protect, adminOrVolunteer, async (req, res) => {
  try {
    const { eventId, name, phone, email, attendeeType, department, employeeId, foodPreference, timeSlotId, notes } = req.body;

    if (!eventId || !attendeeType) {
      return res.status(400).json({ message: 'Event and attendee type are required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
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
      employeeId: employeeId || '',
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
    res.status(500).json({ message: error.message });
  }
});

// POST /api/walkins/scan - handle walk-in QR scan (auto check-in)
router.post('/scan', protect, adminOrVolunteer, async (req, res) => {
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

    const walkIn = await WalkIn.create({
      event: parsed.eventId,
      name: (name || TYPE_LABELS[parsed.attendeeType] || 'Walk-in').trim(),
      phone: phone || '',
      attendeeType: parsed.attendeeType,
      department: department || '',
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
    res.status(500).json({ message: error.message });
  }
});

// GET /api/walkins/event/:eventId/qrcodes - get pre-generated QR codes for an event
router.get('/event/:eventId/qrcodes', protect, adminOrVolunteer, async (req, res) => {
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
    res.status(500).json({ message: error.message });
  }
});

// GET /api/walkins/event/:eventId - list walk-ins for an event
router.get('/event/:eventId', protect, adminOrVolunteer, async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = { event: req.params.eventId };

    if (type) filter.attendeeType = type;

    let walkIns = await WalkIn.find(filter)
      .populate('checkedInBy', 'name employeeId')
      .populate('event', 'title eventDate venue')
      .sort({ createdAt: -1 });

    if (search) {
      const s = search.toLowerCase();
      walkIns = walkIns.filter(w =>
        w.name.toLowerCase().includes(s) ||
        (w.employeeId && w.employeeId.toLowerCase().includes(s)) ||
        (w.phone && w.phone.includes(s))
      );
    }

    const stats = {
      total: walkIns.length,
      guest: walkIns.filter(w => w.attendeeType === 'guest').length,
      staff: walkIns.filter(w => w.attendeeType === 'staff').length,
      housekeeping: walkIns.filter(w => w.attendeeType === 'housekeeping').length,
      unregisteredEmployee: walkIns.filter(w => w.attendeeType === 'unregistered_employee').length,
    };

    res.json({ walkIns, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
