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
        maxOutputTokens: 1000,
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

const generateSOSVoiceScript = async (userName, locationAddress) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

  if (!apiKey) {
    console.warn('⚠️ Gemini API key is not configured for voice script generation. Using fallback.');
    return null;
  }

  try {
    const prompt = `You are a professional emergency voice calling assistant for "Sanket", a women's safety platform.
Generate a highly urgent, clear, and calm voice message to be spoken to the emergency contact of ${userName}.
The user is in danger and needs immediate help.
Their location is: ${locationAddress || 'unknown location'}.

The voice call must convey this information:
1. This is an emergency alert from Sanket on behalf of ${userName}.
2. ${userName} is in immediate danger and needs your help.
3. Their current location is: ${locationAddress || 'unknown location'}.
4. A WhatsApp message has been sent with a live location tracking link.
5. They must check WhatsApp immediately.

Important Constraints:
- Output your response in a raw JSON object format with exactly two keys: "english" and "hindi".
- Do NOT add any markdown formatting (like \`\`\`json or \`\`\`), explanation, introductory/concluding text, or conversational filler. Output ONLY the raw JSON string.
- Under "english", write the English version of the spoken script (concise, under 45 words).
- Under "hindi", write the Hindi translation of the spoken script (concise translation, under 45 words, written in standard Devanagari script).
- Tone must be urgent, clear, and calm.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await axios.post(
      url,
      {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json'
        },
      },
      {
        params: { key: apiKey },
        timeout: 10000,
      }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!rawText) return null;

    try {
      let cleaned = rawText;
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '');
      }
      const data = JSON.parse(cleaned);
      if (data.english && data.hindi) {
        return {
          english: data.english.trim(),
          hindi: data.hindi.trim()
        };
      }
    } catch (parseErr) {
      console.warn('⚠️ Gemini output could not be parsed as structured JSON, trying to treat as raw text:', parseErr.message);
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to generate AI voice script:', error.message);
    return null;
  }
};

module.exports = { generateSafetyReply, generateSOSVoiceScript };

