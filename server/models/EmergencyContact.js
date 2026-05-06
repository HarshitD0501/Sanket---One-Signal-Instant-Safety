const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  relation: {
    type: String,
    required: [true, 'Relation is required'],
    enum: ['Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Other'],
    default: 'Other',
  },
  whatsappEnabled: {
    type: Boolean,
    default: true,
  },
  callEnabled: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Limit to 5 contacts per user
emergencyContactSchema.statics.countByUser = function (userId) {
  return this.countDocuments({ userId });
};

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
