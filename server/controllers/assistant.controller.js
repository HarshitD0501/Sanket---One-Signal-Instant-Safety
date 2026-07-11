const { generateSafetyReply } = require('../services/gemini.service');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ITEMS = 8;

const chatWithAssistant = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    if (history !== undefined && !Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        message: 'History must be an array.',
      });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-MAX_HISTORY_ITEMS).filter((item) => (
          item
          && typeof item.text === 'string'
          && item.text.trim()
          && ['user', 'assistant'].includes(item.role)
        ))
      : [];

    const reply = await generateSafetyReply({
      message: trimmedMessage,
      history: safeHistory,
    });

    res.json({
      success: true,
      data: { reply },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { chatWithAssistant };
