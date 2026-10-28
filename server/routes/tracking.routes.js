const router = require('express').Router();
const { getTrackingData, updateLocation } = require('../controllers/tracking.controller');
const auth = require('../middleware/auth.middleware');
const rateLimit = require('../middleware/rateLimit.middleware');

// Public tracking fetch limiter (60 req/min per IP)
const trackingPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  name: 'tracking-public',
  message: 'Too many tracking requests. Please slow down.',
});

// Location update limiter (30 req/min per user — client interval is 5s)
const locationUpdateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  name: 'location-update',
  message: 'Too many location updates. Please wait a few seconds.',
});

// Public — tracking page data (no auth needed)
router.get('/:trackingId', trackingPublicLimiter, getTrackingData);

// Private — push location updates during active SOS
router.post('/update-location', auth, locationUpdateLimiter, updateLocation);

module.exports = router;
