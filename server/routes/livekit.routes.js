const router = require('express').Router();
const { createLiveKitToken } = require('../controllers/livekit.controller');

router.post('/token', createLiveKitToken);

module.exports = router;
