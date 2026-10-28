const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/db');
const { isTrackingExpired, MAX_TRAIL_POINTS } = require('../controllers/tracking.controller');
const { createLiveKitToken } = require('../controllers/livekit.controller');
const { formatPhoneForWhatsApp } = require('../services/whatsapp.service');
const { formatPhoneForTwilio, generateSOSTwiML } = require('../services/twilio.service');
const rateLimit = require('../middleware/rateLimit.middleware');
const errorHandler = require('../middleware/error.middleware');
const migration = require('../migrations/20261028_01_init_schema');

test.after(async () => {
  try {
    await sequelize.close();
  } catch (_e) {}
});

test('TASK-012 Cross-Flow 1: SOS Lifecycle from Trigger to Resolution and Expiration', async (t) => {
  await t.test('active SOS within 24 hours is valid and not expired', () => {
    const activeSOS = {
      id: 'sos_123',
      userId: 42,
      status: 'active',
      trackingExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12h remaining
      createdAt: new Date(),
    };
    assert.equal(isTrackingExpired(activeSOS), false, 'Active SOS within TTL must not be expired');
  });

  await t.test('active SOS exceeding 24 hours is expired (AUDIT-002)', () => {
    const expiredActiveSOS = {
      id: 'sos_124',
      userId: 42,
      status: 'active',
      trackingExpiresAt: new Date(Date.now() - 1000 * 60 * 10), // expired 10m ago
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
    };
    assert.equal(isTrackingExpired(expiredActiveSOS), true, 'Active SOS past TTL must be expired');
  });

  await t.test('resolved SOS within grace period (e.g. 2 hours) remains viewable', () => {
    const resolvedRecent = {
      id: 'sos_125',
      userId: 42,
      status: 'resolved',
      trackingExpiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h grace remaining
      resolvedAt: new Date(Date.now() - 1000 * 60 * 60),
    };
    assert.equal(isTrackingExpired(resolvedRecent), false, 'Resolved SOS within grace period must be viewable');
  });

  await t.test('resolved SOS after grace period expires', () => {
    const resolvedExpired = {
      id: 'sos_126',
      userId: 42,
      status: 'resolved',
      trackingExpiresAt: new Date(Date.now() - 1000 * 60 * 5),
      resolvedAt: new Date(Date.now() - 1000 * 60 * 130),
    };
    assert.equal(isTrackingExpired(resolvedExpired), true, 'Resolved SOS past grace period must be expired');
  });
});

test('TASK-012 Cross-Flow 2: Phone Normalization and Provider Eligibility', async (t) => {
  await t.test('WhatsApp phone normalization strips non-digits and leading plus', () => {
    assert.equal(formatPhoneForWhatsApp('+91 98765-43210'), '919876543210');
    assert.equal(formatPhoneForWhatsApp('9876543210'), '919876543210');
    assert.equal(formatPhoneForWhatsApp('09876543210'), '919876543210');
    assert.equal(formatPhoneForWhatsApp(''), '');
  });

  await t.test('Twilio phone normalization formats valid E.164 with leading plus', () => {
    assert.equal(formatPhoneForTwilio('+91 98765-43210'), '+919876543210');
    assert.equal(formatPhoneForTwilio('9876543210'), '+919876543210');
    assert.equal(formatPhoneForTwilio('09876543210'), '+919876543210');
    assert.equal(formatPhoneForTwilio(''), '');
  });

  await t.test('Emergency call uses immediate bilingual TwiML fallback without LLM wait', () => {
    const twiml = generateSOSTwiML('Riya', '+919876543210', 'Near Connaught Place', null);
    assert.ok(twiml.includes('<Response>'), 'Must produce standard TwiML response tag');
    assert.ok(twiml.includes('Polly.Aditi'), 'Must include Hindi Polly voice');
    assert.ok(twiml.includes('en-IN'), 'Must include Indian English voice');
    assert.ok(twiml.includes('hi-IN'), 'Must include Hindi language');
    assert.ok(twiml.includes('Riya'), 'Must mention user name');
    assert.ok(twiml.includes('Near Connaught Place'), 'Must mention location');
  });
});

test('TASK-012 Cross-Flow 3: Rate Limiter Policy Isolation and Quota Integrity', async (t) => {
  await t.test('independent rate limiter instances do not share client quota counters', () => {
    const globalLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      name: 'global',
    });

    const authLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      name: 'auth',
    });

    const createMockReq = (ip) => ({
      ip,
      headers: {},
      socket: { remoteAddress: ip },
    });

    const createMockRes = () => {
      const headers = {};
      return {
        statusCode: 200,
        headers,
        setHeader(name, val) { headers[name.toLowerCase()] = val; },
        set(name, val) { return this.setHeader(name, val); },
        status(code) { this.statusCode = code; return this; },
        json(body) { this._json = body; return this; },
      };
    };

    const req = createMockReq('192.168.1.50');

    // Consume 2 requests on globalLimiter
    let nextCount = 0;
    const next = () => { nextCount++; };

    const res1 = createMockRes();
    globalLimiter(req, res1, next);
    assert.equal(res1.statusCode, 200);

    const res2 = createMockRes();
    globalLimiter(req, res2, next);
    assert.equal(res2.statusCode, 200);

    // 3rd request to globalLimiter is blocked (429)
    const res3 = createMockRes();
    globalLimiter(req, res3, next);
    assert.equal(res3.statusCode, 429);
    assert.match(res3._json.message, /too many requests/i);

    // The SAME client making a request to authLimiter must NOT be blocked
    const resAuth = createMockRes();
    authLimiter(req, resAuth, next);
    assert.equal(resAuth.statusCode, 200, 'Auth limiter must have independent quota from global limiter');
  });
});

test('TASK-012 Cross-Flow 4: Sanitized Error Boundaries (AUDIT-014)', async (t) => {
  await t.test('unexpected 500 error redacts sensitive stack traces and returns correlation ID', () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = { method: 'POST', originalUrl: '/api/sos/trigger', ip: '127.0.0.1' };
    const mockRes = {
      status(code) { responseStatus = code; return this; },
      json(body) { responseBody = body; return this; },
    };

    const fatalError = new Error('FATAL: password authentication failed for user "postgres" at connection /var/run/postgresql');
    fatalError.stack = 'Error: FATAL\n    at Connection.parseE (/server/node_modules/pg/lib/connection.js:614:13)';

    errorHandler(fatalError, mockReq, mockRes, () => {});

    assert.equal(responseStatus, 500);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, 'Internal Server Error');
    assert.ok(responseBody.errorId, 'Must return a unique correlation errorId');
    assert.equal(responseBody.stack, undefined, 'Must never leak stack trace in response');
    assert.ok(!JSON.stringify(responseBody).includes('postgres'), 'Must not leak database credentials or internal details');
  });

  await t.test('actionable 4xx client errors preserve helpful message', () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = { method: 'GET', originalUrl: '/api/tracking/invalid-token', ip: '127.0.0.1' };
    const mockRes = {
      status(code) { responseStatus = code; return this; },
      json(body) { responseBody = body; return this; },
    };

    const clientError = new Error('This tracking link has expired or is invalid.');
    clientError.statusCode = 410;

    errorHandler(clientError, mockReq, mockRes, () => {});

    assert.equal(responseStatus, 410);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, 'This tracking link has expired or is invalid.');
  });
});

test('TASK-012 Cross-Flow 5: LiveKit Room Authorization & Guest Restrictions (AUDIT-005, AUDIT-013)', async (t) => {
  await t.test('authenticated user cannot join an arbitrary unassigned room', async () => {
    process.env.LIVEKIT_API_KEY = 'test_key';
    process.env.LIVEKIT_API_SECRET = 'test_secret_123456789012345678901234567890';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    const mockReq = {
      user: { id: 7, name: 'Ananya' },
      body: { roomName: 'sanket-assistant-user-999' }, // attempting to access user 999's room
    };

    let statusCode = null;
    let responseBody = null;
    const mockRes = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    await createLiveKitToken(mockReq, mockRes, (err) => { throw err; });

    assert.equal(statusCode, 403, 'Must return 403 Forbidden when requesting another user private room');
    assert.equal(responseBody.success, false);
    assert.match(responseBody.message, /not authorized/i);
  });

  await t.test('authenticated user with omitted room receives their own server-derived private room', async () => {
    process.env.LIVEKIT_API_KEY = 'test_key';
    process.env.LIVEKIT_API_SECRET = 'test_secret_123456789012345678901234567890';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    const mockReq = {
      user: { id: 7, name: 'Ananya' },
      body: {}, // room omitted
    };

    let statusCode = 200;
    let responseBody = null;
    const mockRes = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    await createLiveKitToken(mockReq, mockRes, (err) => { throw err; });

    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.roomName, 'sanket-assistant-7');
    assert.ok(responseBody.data.token, 'Must return signed token for sanket-assistant-7 room');
  });
});

test('TASK-012 Cross-Flow 6: Bounded Location History Query Limits (AUDIT-009)', async (t) => {
  await t.test('MAX_TRAIL_POINTS bound is explicitly enforced to protect client and server memory', () => {
    assert.equal(MAX_TRAIL_POINTS, 500, 'MAX_TRAIL_POINTS must be bounded at 500 points');
  });
});

test('TASK-012 Cross-Flow 7: PostgreSQL Schema Migration Contracts (AUDIT-015)', async (t) => {
  await t.test('migration creates core tables and partial unique active-SOS index', async () => {
    const createdTables = [];
    const createdIndexes = [];

    const mockQueryInterface = {
      createTable: async (tableName, attributes) => {
        createdTables.push(tableName);
      },
      addIndex: async (tableName, fields, options) => {
        createdIndexes.push({ tableName, fields, options });
      },
    };

    const mockSequelize = {
      fn: (fnName) => fnName,
      DataTypes: {
        INTEGER: 'INTEGER',
        STRING: () => 'STRING',
        TEXT: 'TEXT',
        DOUBLE: 'DOUBLE',
        FLOAT: 'FLOAT',
        BOOLEAN: 'BOOLEAN',
        DATE: 'DATE',
      },
    };

    await migration.up(mockQueryInterface, mockSequelize);

    assert.deepEqual(
      createdTables,
      ['users', 'emergency_contacts', 'sos_events', 'sos_notifications', 'location_points'],
      'Must create all 5 required tables'
    );

    const activeSosIndex = createdIndexes.find(
      (idx) => idx.options && idx.options.name === 'one_active_sos_per_user'
    );
    assert.ok(activeSosIndex, 'one_active_sos_per_user index must be created');
    assert.equal(activeSosIndex.options.unique, true, 'Active SOS index must be unique');
    assert.ok(
      activeSosIndex.options.where && activeSosIndex.options.where.status === 'active',
      'Index must be partial on status = active'
    );
  });
});
