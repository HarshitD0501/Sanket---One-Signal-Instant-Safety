const axios = require('axios');

const SAFETY_PROMPT = [
  'You are Sanket, a crisis-focused women safety assistant.',
  'Keep responses short, calm, and action-oriented.',
  'First check whether the user is safe to speak. If not, suggest text or silent actions.',
  'If there is immediate danger, tell the user to contact local emergency services. In India, mention 112.',
  'Ask only one or two necessary questions at a time.',
  'Do not claim that you contacted police, family, or emergency contacts unless the app explicitly confirms it.',
].join(' ');

const toGeminiContents = (history, message) => {
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const contents = safeHistory
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text.slice(0, 1200) }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: String(message).slice(0, 2000) }],
  });

  return contents;
};

const generateSafetyReply = async ({ message, history }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

  if (!apiKey) {
    const error = new Error('Gemini API key is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await axios.post(
    url,
    {
      systemInstruction: {
        parts: [{ text: SAFETY_PROMPT }],
      },
      contents: toGeminiContents(history, message),
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 220,
      },
    },
    {
      params: { key: apiKey },
      timeout: 20000,
    }
  );

  const text = response.data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    const error = new Error('Gemini returned an empty response.');
    error.statusCode = 502;
    throw error;
  }

  return text;
};

module.exports = { generateSafetyReply };
