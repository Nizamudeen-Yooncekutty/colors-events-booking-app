const mongoose = require('mongoose');

const foodOptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  maxQuantity: { type: Number, default: 0 }, // 0 = unlimited
}, { _id: true });

const timeSlotSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  maxCapacity: { type: Number, default: 0 },
}, { _id: true });

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  eventDate: {
    type: Date,
    required: true,
  },
  venue: {
    type: String,
    required: true,
    trim: true,
  },
  registrationStart: {
    type: Date,
    required: true,
  },
  registrationEnd: {
    type: Date,
    required: true,
  },
  maxCapacity: {
    type: Number,
    default: 0, // 0 = unlimited
  },
  timeSlots: [timeSlotSchema],
  foodOptions: [foodOptionSchema],
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'completed'],
    default: 'draft',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  bannerImage: {
    type: String,
    default: '',
  },
}, { timestamps: true });

eventSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'event',
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
