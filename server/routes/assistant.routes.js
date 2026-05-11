const router = require('express').Router();
const { chatWithAssistant } = require('../controllers/assistant.controller');

router.post('/chat', chatWithAssistant);

module.exports = router;
