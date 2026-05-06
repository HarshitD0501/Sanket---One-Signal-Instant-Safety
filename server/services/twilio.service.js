const twilio = require('twilio');

/**
 * Initiate an emergency voice call via Twilio
 * @param {string} to - Recipient phone number
 * @param {string} userName - Name of the person in distress
 * @param {string} address - Location address
 * @param {string} trackingUrl - Live tracking URL
 * @returns {Promise<object>} Call result
 */
const makeEmergencyCall = async (to, userName, address, trackingUrl) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioNumber) {
    console.warn('⚠️  Twilio credentials not configured. Skipping voice call.');
    return { success: false, reason: 'not_configured' };
  }

  const client = twilio(accountSid, authToken);

  // TwiML voice message
  const twiml =
    `<Response>` +
    `<Say voice="alice" language="en-IN">` +
    `Emergency alert from Sanket! ` +
    `${userName} has triggered an S O S from ${address || 'an unknown location'}. ` +
    `Please check on them immediately. ` +
    `A WhatsApp message with the live tracking link has been sent to you. ` +
    `</Say>` +
    `<Pause length="1"/>` +
    `<Say voice="alice" language="en-IN">` +
    `Repeating: ${userName} needs your help urgently. ` +
    `Please open the tracking link on WhatsApp. ` +
    `</Say>` +
    `</Response>`;

  try {
    const call = await client.calls.create({
      twiml: twiml,
      to: to,
      from: twilioNumber,
    });

    console.log(`✅ Voice call initiated to ${to} — SID: ${call.sid}`);
    return {
      success: true,
      callSid: call.sid,
      status: call.status,
    };
  } catch (error) {
    console.error(`❌ Voice call failed to ${to}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  makeEmergencyCall,
};
