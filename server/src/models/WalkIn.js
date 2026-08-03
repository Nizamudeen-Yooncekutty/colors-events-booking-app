const mongoose = require('mongoose');

const walkInSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    default: '',
    trim: true,
  },
  email: {
    type: String,
    default: '',
    trim: true,
  },
  attendeeType: {
    type: String,
    enum: ['guest', 'staff', 'housekeeping', 'unregistered_employee'],
    required: true,
  },
  department: {
    type: String,
    default: '',
    trim: true,
  },
  employeeId: {
    type: String,
    default: '',
    trim: true,
  },
  foodPreference: {
    type: String,
    default: '',
    trim: true,
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
  notes: {
    type: String,
    default: '',
    trim: true,
  },
  checkedInAt: {
    type: Date,
    default: () => new Date(),
  },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('WalkIn', walkInSchema);
