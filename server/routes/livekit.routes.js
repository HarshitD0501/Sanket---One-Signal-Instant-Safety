const router = require('express').Router();
const { createLiveKitToken } = require('../controllers/livekit.controller');
const auth = require('../middleware/auth.middleware');
const rateLimit = require('../middleware/rateLimit.middleware');

const livekitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 6,
  message: 'Too many voice session requests. Please wait and try again.',
});

router.post('/token', auth, livekitLimiter, createLiveKitToken);

module.exports = router;
