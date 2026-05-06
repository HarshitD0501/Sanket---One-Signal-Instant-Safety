const twilio = require('twilio');

const getClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
};

/**
 * Send WhatsApp message via Twilio WhatsApp API
 */
const sendWhatsAppMessage = async (to, message) => {
  const client = getClient();
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (!client) {
    console.warn('⚠️  Twilio credentials not configured. Skipping WhatsApp.');
    return { success: false, reason: 'not_configured' };
  }

  try {
    // Format: whatsapp:+919454535137
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

    const msg = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
    });

    console.log(`✅ WhatsApp message sent to ${to} — SID: ${msg.sid}`);
    return { success: true, sid: msg.sid };
  } catch (error) {
    console.error(`❌ WhatsApp send failed to ${to}:`, error.message);
    return { success: false, error: error.message };
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

module.exports = { sendWhatsAppMessage, sendSOSAlert, sendAllClearMessage };
