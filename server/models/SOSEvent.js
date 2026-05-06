const mongoose = require('mongoose');

const sosEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  triggerType: {
    type: String,
    required: true,
    enum: ['tap', 'shake'],
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'resolved', 'false_alarm'],
    default: 'active',
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' },
  },
  trackingId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  notifications: [{
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyContact',
    },
    contactName: String,
    contactPhone: String,
    whatsappSent: { type: Boolean, default: false },
    whatsappSentAt: { type: Date, default: null },
    voiceCallSid: { type: String, default: null },
    voiceCallStatus: {
      type: String,
      enum: ['queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', null],
      default: null,
    },
    voiceCalledAt: { type: Date, default: null },
  }],
  resolvedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SOSEvent', sosEventSchema);
