const test = require('node:test');
const assert = require('node:assert/strict');
const wa = require('../services/whatsapp.service');
const twilioService = require('../services/twilio.service');

test('AUDIT-004: WhatsApp emergency messaging and template delivery contracts', async (t) => {
  await t.test('normalizes various phone numbers to Meta Cloud API digits without plus', () => {
    assert.equal(wa.formatPhoneForWhatsApp('9876543210'), '919876543210');
    assert.equal(wa.formatPhoneForWhatsApp('09876543210'), '919876543210');
    assert.equal(wa.formatPhoneForWhatsApp('+91 98765-43210'), '919876543210');
    assert.equal(wa.formatPhoneForWhatsApp('919876543210'), '919876543210');
    assert.equal(wa.formatPhoneForWhatsApp(''), '');
  });

  await t.test('short-circuits with invalid_phone on non-numeric phone number', async () => {
    const contact = { phone: 'invalid-number' };
    const user = { name: 'User', phone: '9999999999' };
    const location = { lat: 28.6, lng: 77.2, address: 'Connaught Place' };
    const result = await wa.sendSOSAlert(contact, user, location, 'https://example.com/track/123');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'invalid_phone');
  });

  await t.test('returns template_missing when WHATSAPP_SOS_TEMPLATE is not configured and fallback disabled', async () => {
    const origTemplate = process.env.WHATSAPP_SOS_TEMPLATE;
    const origFallback = process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK;
    const origId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const origToken = process.env.WHATSAPP_ACCESS_TOKEN;

    try {
      delete process.env.WHATSAPP_SOS_TEMPLATE;
      delete process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK;
      process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
      process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';

      const contact = { phone: '9876543210' };
      const user = { name: 'Priya', phone: '9876543210' };
      const location = { lat: 28.6, lng: 77.2, address: 'Test Location' };

      const result = await wa.sendSOSAlert(contact, user, location, 'https://example.com/track/123');
      assert.equal(result.success, false);
      assert.equal(result.reason, 'template_missing');
      assert.match(result.error, /WHATSAPP_SOS_TEMPLATE is not configured/i);
    } finally {
      process.env.WHATSAPP_SOS_TEMPLATE = origTemplate;
      process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK = origFallback;
      process.env.WHATSAPP_PHONE_NUMBER_ID = origId;
      process.env.WHATSAPP_ACCESS_TOKEN = origToken;
    }
  });

  await t.test('returns not_configured when WhatsApp Cloud API credentials are missing', async () => {
    const origId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const origToken = process.env.WHATSAPP_ACCESS_TOKEN;

    try {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.WHATSAPP_ACCESS_TOKEN;

      const contact = { phone: '9876543210' };
      const user = { name: 'Priya', phone: '9876543210' };
      const location = { lat: 28.6, lng: 77.2, address: 'Test Location' };

      // Set fallback to true to reach config check
      process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK = 'true';
      const result = await wa.sendSOSAlert(contact, user, location, 'https://example.com/track/123');
      assert.equal(result.success, false);
      assert.equal(result.reason, 'not_configured');
    } finally {
      process.env.WHATSAPP_PHONE_NUMBER_ID = origId;
      process.env.WHATSAPP_ACCESS_TOKEN = origToken;
      delete process.env.ALLOW_WHATSAPP_FREEFORM_FALLBACK;
    }
  });
});

test('AUDIT-010: Emergency call path latency & deterministic fallback', async (t) => {
  await t.test('normalizes phone numbers to standard E.164 with plus', () => {
    assert.equal(twilioService.formatPhoneForTwilio('9876543210'), '+919876543210');
    assert.equal(twilioService.formatPhoneForTwilio('09876543210'), '+919876543210');
    assert.equal(twilioService.formatPhoneForTwilio('919876543210'), '+919876543210');
    assert.equal(twilioService.formatPhoneForTwilio('+91 98765-43210'), '+919876543210');
    assert.equal(twilioService.formatPhoneForTwilio(''), '');
  });

  await t.test('generates valid bilingual TwiML immediately without external LLM wait', () => {
    // First call warms up the Twilio VoiceResponse XML serializer
    twilioService.generateSOSTwiML('Warmup', '+910000000000', 'Loc', null);

    const startTime = Date.now();
    const twiml = twilioService.generateSOSTwiML('Asha', '+919876543210', 'Janpath, New Delhi', null);
    const durationMs = Date.now() - startTime;

    assert.ok(durationMs < 200, `TwiML generation must be immediate, took ${durationMs}ms`);
    assert.match(twiml, /<Response>/);
    assert.match(twiml, /Emergency Alert from Sanket! Asha is in danger/);
    assert.match(twiml, /Polly\.Aditi/);
    assert.match(twiml, /language="en-IN"/);
    assert.match(twiml, /language="hi-IN"/);
    assert.match(twiml, /यह संकेत ऐप से एक आपातकालीन अलर्ट है।/);
  });

  await t.test('makeEmergencyCall short-circuits safely when Twilio is not configured', async () => {
    const origSid = process.env.TWILIO_ACCOUNT_SID;
    const origToken = process.env.TWILIO_AUTH_TOKEN;

    try {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      const contact = { phone: '9876543210' };
      const user = { name: 'Asha', phone: '+919876543210' };
      const location = { address: 'Test address' };

      const result = await twilioService.makeEmergencyCall(contact, user, location);
      assert.equal(result.success, false);
      assert.equal(result.reason, 'not_configured');
    } finally {
      process.env.TWILIO_ACCOUNT_SID = origSid;
      process.env.TWILIO_AUTH_TOKEN = origToken;
    }
  });

  await t.test('makeEmergencyCall rejects invalid contact phone numbers before calling provider', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'testtoken';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';

    try {
      const contact = { phone: 'invalid' };
      const user = { name: 'Asha', phone: '+919876543210' };
      const location = { address: 'Test address' };

      const result = await twilioService.makeEmergencyCall(contact, user, location);
      assert.equal(result.success, false);
      assert.equal(result.reason, 'invalid_phone');
    } finally {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;
    }
  });
});
