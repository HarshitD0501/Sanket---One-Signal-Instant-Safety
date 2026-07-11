const dotenv = require('dotenv');
const path = require('path');
const { sendWhatsAppMessage, formatPhoneForTwilio } = require('./services/whatsapp.service');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const maskPhone = (phone = '') => {
  const text = String(phone);
  if (text.length <= 4) return '****';
  return `${'*'.repeat(Math.max(text.length - 4, 0))}${text.slice(-4)}`;
};

const run = async () => {
  const to = process.env.TEST_WHATSAPP_TO || process.argv[2];
  if (!to) {
    console.error('Provide TEST_WHATSAPP_TO or pass a recipient phone as the first CLI argument.');
    process.exit(1);
  }

  const location = {
    lat: Number(process.env.TEST_LAT || 26.8467),
    lng: Number(process.env.TEST_LNG || 80.9462),
    address: process.env.TEST_ADDRESS || 'Test location',
  };
  const userName = process.env.TEST_USER_NAME || 'Test User';
  const userPhone = process.env.TEST_USER_PHONE || '+910000000000';
  const trackingUrl = process.env.TEST_TRACKING_URL || 'http://localhost:5173/track/test-tracking-id';
  const mapLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const message = [
    'SOS ALERT from Sanket!',
    '',
    `${userName} needs help RIGHT NOW!`,
    '',
    `Location: ${location.address}`,
    `Map: ${mapLink}`,
    '',
    `Live Tracking: ${trackingUrl}`,
    '',
    `Time: ${time}`,
    `Contact: ${userPhone}`,
    '',
    'Please check on them immediately.',
  ].join('\n');

  const formattedTo = formatPhoneForTwilio(to);
  console.log(`Sending diagnostic SOS WhatsApp to ${maskPhone(formattedTo)}.`);

  const result = await sendWhatsAppMessage(formattedTo, message);
  if (!result.success) {
    console.error('Diagnostic SOS WhatsApp failed:', result.error || result.reason || 'unknown_error');
    process.exit(1);
  }

  console.log(`Diagnostic SOS WhatsApp queued. SID: ${result.sid}`);
};

run().catch((error) => {
  console.error('Diagnostic SOS WhatsApp failed:', error.message);
  process.exit(1);
});
