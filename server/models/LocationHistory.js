const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema({
  sosEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOSEvent',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  coordinates: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('LocationHistory', locationHistorySchema);
