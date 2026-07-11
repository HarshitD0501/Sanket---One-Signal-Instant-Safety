const router = require('express').Router();
const { chatWithAssistant } = require('../controllers/assistant.controller');
const auth = require('../middleware/auth.middleware');
const rateLimit = require('../middleware/rateLimit.middleware');

const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: 'Too many assistant messages. Please wait a moment and try again.',
});

router.post('/chat', auth, assistantLimiter, chatWithAssistant);

module.exports = router;
