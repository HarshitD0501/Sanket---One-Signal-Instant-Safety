const https = require('https');
const axios = require('axios');

// WhatsApp Business Cloud API (Meta Graph API).
// Replaces the old Twilio WhatsApp channel. Voice calls remain on Twilio.
//
// Required env:
//   WHATSAPP_PHONE_NUMBER_ID  - the sender's phone-number id from Meta
//   WHATSAPP_ACCESS_TOKEN     - permanent system-user token
// Optional env:
//   WHATSAPP_API_VERSION      - default v21.0
//   WHATSAPP_SOS_TEMPLATE     - approved template name for SOS alerts
//   WHATSAPP_ALLCLEAR_TEMPLATE- approved template name for all-clear
//   WHATSAPP_TEMPLATE_LANG    - template language code, default en
//
// NOTE: business-initiated messages (an SOS to a contact who has NOT messaged
// this number in the last 24h) MUST use an approved template. Free-form text
// only reaches users inside an open 24h customer-service window.

// ponytail: one keep-alive agent reused across all sends — kills TLS/TCP
// handshake cost on repeat calls, the only latency we actually control.
const agent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const api = axios.create({
  httpsAgent: agent,
  timeout: Number(process.env.WHATSAPP_TIMEOUT_MS) || 8000,
});

const config = () => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  return {
    url: `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    lang: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
  };
};

/**
 * Normalize to Cloud API form: country-code digits, NO leading '+'.
 * Defaults bare 10-digit / 0-prefixed numbers to India (+91).
 */
const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  else if (d.length === 11 && d.startsWith('0')) d = `91${d.slice(1)}`;
  return d;
};

// Template params reject newlines / tabs / >4 consecutive spaces — flatten them.
const cleanParam = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 1024) || 'N/A';

const post = async (body) => {
  const cfg = config();
  if (!cfg) {
    console.error('❌ WhatsApp Cloud API not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).');
    return { success: false, reason: 'not_configured', error: 'WhatsApp Cloud API credentials missing' };
  }
  try {
    const res = await api.post(cfg.url, body, { headers: cfg.headers });
    const id = res.data?.messages?.[0]?.id || null;
    console.log(`✅ WhatsApp Cloud message accepted for ${body.to} — id: ${id}`);
    return { success: true, provider: 'whatsapp_cloud', id, status: 'accepted' };
  } catch (error) {
    const apiErr = error.response?.data?.error;
    let reason = 'send_failed';
    if (apiErr?.code === 131047) reason = 'outside_24h_window';
    else if (apiErr?.code === 132000 || apiErr?.code === 132001) reason = 'template_error';
    else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) reason = 'timeout';

    const msg = apiErr?.message || error.message;
    console.error(`❌ WhatsApp Cloud send failed to ${body.to}: ${msg}`);
    return { success: false, reason, error: `WhatsApp Cloud: ${msg}` };
  }
};

const sendTemplate = (to, template, params) => {
  const cfg = config();
  const components = params?.length
    ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: cleanParam(p) })) }]
    : undefined;
  return post({
    messaging_product: 'whatsapp',
    to: formatPhoneForWhatsApp(to),
    type: 'template',
    template: { name: template, language: { code: cfg ? cfg.lang : 'en' }, ...(components && { components }) },
  });
};

const sendText = (to, message) => post({
  messaging_product: 'whatsapp',
  to: formatPhoneForWhatsApp(to),
  type: 'text',
  text: { preview_url: true, body: message },
});

/**
 * Public API — unchanged signatures and result shape ({ success, error?, reason? })
 * so consumers remain compatible.
 */
const sendWhatsAppMessage = sendText;

const sendSOSAlert = async (contact, user, location, trackingUrl) => {
  const to = formatPhoneForWhatsApp(contact.phone);
  if (!to) return { success: false, reason: 'invalid_phone', error: 'Invalid contact phone number' };

  const mapLink = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`;
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const template = process.env.WHATSAPP_SOS_TEMPLATE;

  // Business-initiated SOS → approved template is required for delivery outside 24h window.
  if (template) {
    // Approved template body must expose 6 variables, in this order:
    // {{1}} name  {{2}} address  {{3}} map link  {{4}} tracking url  {{5}} time  {{6}} contact phone
    return sendTemplate(to, template, [
      user.name, location.address || 'Unknown', mapLink, trackingUrl, time, user.phone,
    ]);
  }

  // Free-form fallback is permitted ONLY if explicitly opted in for local testing
  if (process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK === 'true') {
    const message =
      `🚨 *SOS ALERT from Sanket!*\n\n*${user.name}* needs help RIGHT NOW!\n\n` +
      `📍 *Location:* ${location.address || 'Unknown'}\n🗺️ *Map:* ${mapLink}\n\n` +
      `🔴 *Live Tracking:* ${trackingUrl}\n\n⏰ *Time:* ${time}\n📱 *Contact:* ${user.phone}\n\n` +
      `_Please check on them immediately!_`;
    return sendText(to, message);
  }

  console.error('❌ WhatsApp Cloud: WHATSAPP_SOS_TEMPLATE is not configured. Meta policy rejects free-form emergency alerts outside a 24h window.');
  return {
    success: false,
    reason: 'template_missing',
    error: 'WHATSAPP_SOS_TEMPLATE is not configured. Outbound emergency alerts require an approved WhatsApp template.',
  };
};

const sendAllClearMessage = async (contact, user) => {
  const to = formatPhoneForWhatsApp(contact.phone);
  if (!to) return { success: false, reason: 'invalid_phone', error: 'Invalid contact phone number' };

  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const template = process.env.WHATSAPP_ALLCLEAR_TEMPLATE;

  if (template) return sendTemplate(to, template, [user.name, time]);

  if (process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK === 'true') {
    const message =
      `✅ *All Clear — Sanket Update*\n\n*${user.name}* has marked themselves as *SAFE*.\n\n` +
      `⏰ *Time:* ${time}\n\n_The emergency alert has been resolved._`;
    return sendText(to, message);
  }

  console.error('❌ WhatsApp Cloud: WHATSAPP_ALLCLEAR_TEMPLATE is not configured.');
  return {
    success: false,
    reason: 'template_missing',
    error: 'WHATSAPP_ALLCLEAR_TEMPLATE is not configured.',
  };
};

module.exports = {
  sendWhatsAppMessage,
  sendSOSAlert,
  sendAllClearMessage,
  sendTemplate,
  sendText,
  formatPhoneForWhatsApp,
};
