const twilio = require('twilio');
const { generateSOSVoiceScript } = require('./gemini.service');

const getClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
};

/**
 * Normalizes phone numbers to standard E.164 format.
 * Strips all spaces, dashes, brackets, backticks, or non-digit/non-plus characters.
 */
const formatPhoneForTwilio = (phone) => {
  if (!phone) return '';
  // Strip all characters except digits and the plus sign
  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  // Indian number starting with 91 but no plus
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  // Indian number starting with 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+91${cleaned.slice(1)}`;
  }
  // Standard 10-digit number
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  // Any other number length (e.g. 12 digits) without plus
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }
  return cleaned;
};

/**
 * Generate TwiML for emergency calls.
 * Uses AI generated text if available, otherwise falls back to static bilingual template.
 */
const generateSOSTwiML = (userName, userPhone, locationAddress, aiSpokenText) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (aiSpokenText) {
    const hasStructured = typeof aiSpokenText === 'object' && aiSpokenText.english && aiSpokenText.hindi;
    const englishText = hasStructured ? aiSpokenText.english : aiSpokenText;
    const hindiText = hasStructured ? aiSpokenText.hindi : null;

    // Speak the AI generated English followed by Hindi, repeated twice
    for (let i = 0; i < 2; i++) {
      response.say({
        voice: 'Polly.Aditi',
        language: 'en-IN',
      }, englishText);

      response.pause({ length: 1 });

      if (hindiText) {
        response.say({
          voice: 'Polly.Aditi',
          language: 'hi-IN',
        }, hindiText);
        response.pause({ length: 2 });
      }
    }
  } else {
    const address = locationAddress || 'an unknown location';

    // ── English Message (repeat 2x) ──
    for (let i = 0; i < 2; i++) {
      response.say({
        voice: 'Polly.Aditi',
        language: 'en-IN',
      },
        `Emergency Alert from Sanket! ` +
        `${userName} is in danger and needs your help immediately. ` +
        `Their last known location is ${address}. ` +
        `A live location link has been shared with you on WhatsApp. ` +
        `Please open WhatsApp and check the tracking link right away. ` +
        `You can also call them back at ${userPhone}. ` +
        `This is an urgent emergency. Please respond immediately.`
      );

      response.pause({ length: 2 });
    }

    // ── Hindi Message (repeat 2x) ──
    for (let i = 0; i < 2; i++) {
      response.say({
        voice: 'Polly.Aditi',
        language: 'hi-IN',
      },
        `यह संकेत ऐप से एक आपातकालीन अलर्ट है। ` +
        `${userName} खतरे में हैं और उन्हें तुरंत आपकी मदद चाहिए। ` +
        `उनकी लोकेशन ${address} है। ` +
        `उनकी लाइव लोकेशन का लिंक आपके WhatsApp पर भेजा गया है। ` +
        `कृपया तुरंत WhatsApp खोलें और ट्रैकिंग लिंक देखें। ` +
        `आप उन्हें इस नंबर पर कॉल भी कर सकते हैं: ${userPhone}। ` +
        `यह एक गंभीर आपातकालीन स्थिति है। कृपया तुरंत जवाब दें।`
      );

      response.pause({ length: 2 });
    }
  }

  return response.toString();
};

/**
 * Make an emergency voice call to a contact
 */
const makeEmergencyCall = async (contact, user, location) => {
  const client = getClient();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !fromNumber) {
    console.warn('⚠️  Twilio credentials not configured. Skipping call.');
    return { success: false, reason: 'not_configured' };
  }

  const toPhone = formatPhoneForTwilio(contact.phone);
  if (!toPhone) {
    console.error(`❌ Cannot place call: contact has invalid phone number.`);
    return { success: false, reason: 'invalid_phone' };
  }

  try {
    // Attempt to generate custom message script with Gemini
    let aiSpokenText = null;
    try {
      aiSpokenText = await generateSOSVoiceScript(user.name, location?.address);
      if (aiSpokenText) {
        console.log(`✨ Gemini generated voice script successfully: "${aiSpokenText}"`);
      }
    } catch (err) {
      console.warn('⚠️ Gemini script generation failed, falling back to static bilingual script:', err.message);
    }

    const twiml = generateSOSTwiML(
      user.name,
      user.phone,
      location?.address,
      aiSpokenText
    );

    const call = await client.calls.create({
      twiml: twiml,
      to: toPhone,
      from: fromNumber,
      timeout: 30,
      record: false,
    });

    console.log(`✅ AI voice call initiated to ${toPhone} — SID: ${call.sid}`);
    return { success: true, sid: call.sid };
  } catch (error) {
    console.error(`❌ Call failed to ${toPhone}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { makeEmergencyCall, generateSOSTwiML, formatPhoneForTwilio };
