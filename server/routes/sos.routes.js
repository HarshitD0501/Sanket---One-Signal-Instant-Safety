const router = require('express').Router();
const { triggerSOS, resolveSOS, getActiveSOS, getSOSHistory } = require('../controllers/sos.controller');
const auth = require('../middleware/auth.middleware');
const rateLimit = require('../middleware/rateLimit.middleware');

const sosTriggerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many SOS trigger attempts. Please wait a moment and try again.',
});

// All SOS routes require authentication
router.use(auth);

router.post('/trigger', sosTriggerLimiter, triggerSOS);
router.patch('/:id/resolve', resolveSOS);
router.get('/active', getActiveSOS);
router.get('/history', getSOSHistory);

module.exports = router;
