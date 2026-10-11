const mongoose = require('mongoose');

const allowedEmployeeSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: 50,
  },
  name: {
    type: String,
    default: '',
    trim: true,
    maxlength: 100,
  },
  location: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
}, { timestamps: true });

module.exports = mongoose.model('AllowedEmployee', allowedEmployeeSchema);
