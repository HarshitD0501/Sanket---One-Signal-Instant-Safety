const router = require('express').Router();
const { triggerSOS, resolveSOS, getActiveSOS, getSOSHistory } = require('../controllers/sos.controller');
const auth = require('../middleware/auth.middleware');

// All SOS routes require authentication
router.use(auth);

router.post('/trigger', triggerSOS);
router.patch('/:id/resolve', resolveSOS);
router.get('/active', getActiveSOS);
router.get('/history', getSOSHistory);

module.exports = router;
