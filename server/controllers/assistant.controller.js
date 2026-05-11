const { generateSafetyReply } = require('../services/gemini.service');

const chatWithAssistant = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
      });
    }

    const reply = await generateSafetyReply({
      message: message.trim(),
      history,
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
