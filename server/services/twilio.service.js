const twilio = require('twilio');

const getClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
};

/**
 * Generate bilingual TwiML (English + Hindi) for emergency calls
 */
const generateSOSTwiML = (userName, userPhone, locationAddress) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

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

  try {
    const twiml = generateSOSTwiML(
      user.name,
      user.phone,
      location?.address
    );

    const call = await client.calls.create({
      twiml: twiml,
      to: contact.phone,
      from: fromNumber,
      // If no answer after 30 seconds, hang up
      timeout: 30,
      // Record the call for safety evidence
      record: false,
    });

    console.log(`✅ Voice call initiated to ${contact.phone} — SID: ${call.sid}`);
    return { success: true, sid: call.sid };
  } catch (error) {
    console.error(`❌ Call failed to ${contact.phone}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { makeEmergencyCall, generateSOSTwiML };
