const mongoose = require('mongoose');

const roleUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  role: {
    type: String,
    enum: ['admin', 'volunteer'],
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedBy: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('RoleUser', roleUserSchema);
