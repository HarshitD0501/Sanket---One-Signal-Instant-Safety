const router = require('express').Router();
const { getTrackingData, updateLocation } = require('../controllers/tracking.controller');
const auth = require('../middleware/auth.middleware');

// Public — tracking page data (no auth needed)
router.get('/:trackingId', getTrackingData);

// Private — push location updates during active SOS
router.post('/update-location', auth, updateLocation);

module.exports = router;
