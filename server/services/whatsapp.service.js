const twilio = require('twilio');

const getClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
};

/**
 * Normalizes phone numbers for Twilio WhatsApp E.164 formatting (starts with '+').
 * Strips any stray spaces, backticks, brackets, dashes, or non-digit characters.
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
 * Send WhatsApp message using Twilio WhatsApp API
 */
const sendWhatsAppMessage = async (to, message) => {
  const client = getClient();
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (!client) {
    console.error('❌ Twilio credentials not configured. WhatsApp send failed completely.');
    return { success: false, reason: 'not_configured', error: 'Twilio credentials not configured' };
  }

  const twilioTo = formatPhoneForTwilio(to);
  if (!twilioTo) {
    console.error(`❌ Cannot send WhatsApp: invalid recipient phone number.`);
    return { success: false, reason: 'invalid_phone' };
  }

  try {
    const formattedTo = twilioTo.startsWith('whatsapp:') ? twilioTo : `whatsapp:${twilioTo}`;
    const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

    const msg = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
    });

    console.log(`✅ Twilio WhatsApp message sent to ${twilioTo} — SID: ${msg.sid}`);
    return { success: true, provider: 'twilio', sid: msg.sid };
  } catch (error) {
    console.error(`❌ Twilio WhatsApp send failed to ${twilioTo}:`, error.message);
    return { success: false, error: `Twilio: ${error.message}` };
  }
};

/**
 * Send SOS alert via WhatsApp
 */
const sendSOSAlert = async (contact, user, location, trackingUrl) => {
  const mapLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const message =
    `🚨 *SOS ALERT from Sanket!*\n\n` +
    `*${user.name}* needs help RIGHT NOW!\n\n` +
    `📍 *Location:* ${location.address || 'Unknown'}\n` +
    `🗺️ *Map:* ${mapLink}\n\n` +
    `🔴 *Live Tracking:* ${trackingUrl}\n\n` +
    `⏰ *Time:* ${time}\n` +
    `📱 *Contact:* ${user.phone}\n\n` +
    `_Please check on them immediately!_`;

  return sendWhatsAppMessage(contact.phone, message);
};

/**
 * Send "All Clear" message
 */
const sendAllClearMessage = async (contact, user) => {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const message =
    `✅ *All Clear — Sanket Update*\n\n` +
    `*${user.name}* has marked themselves as *SAFE*.\n\n` +
    `⏰ *Time:* ${time}\n\n` +
    `_The emergency alert has been resolved._`;

  return sendWhatsAppMessage(contact.phone, message);
};

module.exports = { sendWhatsAppMessage, sendSOSAlert, sendAllClearMessage, formatPhoneForTwilio };
