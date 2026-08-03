const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  timeSlot: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  timeSlotLabel: {
    type: String,
    default: '',
  },
  slotColor: {
    type: String,
    default: '',
  },
  foodPreference: {
    type: String,
    required: true,
    trim: true,
  },
  qrCode: {
    type: String,
    unique: true,
    required: true,
  },
  qrData: {
    type: String,
    unique: true,
    required: true,
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'checked_in'],
    default: 'confirmed',
  },
  checkedInAt: {
    type: Date,
    default: null,
  },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null,
  },
}, { timestamps: true });

// One booking per employee per event
bookingSchema.index({ employee: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
