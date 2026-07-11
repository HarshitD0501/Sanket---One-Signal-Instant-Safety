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
    console.error('Provide a test recipient with TEST_WHATSAPP_TO or as the first CLI argument.');
    process.exit(1);
  }

  const formattedTo = formatPhoneForTwilio(to);
  console.log(`Sending Twilio WhatsApp test to ${maskPhone(formattedTo)}.`);

  const result = await sendWhatsAppMessage(
    formattedTo,
    'Sanket diagnostic WhatsApp test. Please ignore if received during setup.'
  );

  if (!result.success) {
    console.error('WhatsApp test failed:', result.error || result.reason || 'unknown_error');
    process.exit(1);
  }

  console.log(`WhatsApp test queued. SID: ${result.sid}`);
};

run().catch((error) => {
  console.error('WhatsApp diagnostic failed:', error.message);
  process.exit(1);
});
