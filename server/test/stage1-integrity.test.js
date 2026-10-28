const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/db');
const { isTrackingExpired } = require('../controllers/tracking.controller');
const { createLiveKitToken } = require('../controllers/livekit.controller');

test.after(async () => {
  await sequelize.close();
});

test('AUDIT-002: Tracking expiration policy', async (t) => {
  await t.test('returns true for expired active SOS event (regression check)', () => {
    const activeExpired = {
      status: 'active',
      trackingExpiresAt: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
    };
    assert.equal(isTrackingExpired(activeExpired), true, 'Active event with past trackingExpiresAt must be expired');
  });

  await t.test('returns false for non-expired active SOS event', () => {
    const activeValid = {
      status: 'active',
      trackingExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h future
      createdAt: new Date(),
    };
    assert.equal(isTrackingExpired(activeValid), false, 'Active event with future trackingExpiresAt must not be expired');
  });

  await t.test('returns true for expired resolved SOS event', () => {
    const resolvedExpired = {
      status: 'resolved',
      trackingExpiresAt: new Date(Date.now() - 1000 * 60 * 10), // 10 min ago
      resolvedAt: new Date(Date.now() - 1000 * 60 * 70),
    };
    assert.equal(isTrackingExpired(resolvedExpired), true, 'Resolved event with past trackingExpiresAt must be expired');
  });

  await t.test('returns false for resolved SOS within grace period', () => {
    const resolvedGracePeriod = {
      status: 'resolved',
      trackingExpiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 min future
      resolvedAt: new Date(),
    };
    assert.equal(isTrackingExpired(resolvedGracePeriod), false, 'Resolved event within grace period must not be expired');
  });

  await t.test('returns true for legacy record without trackingExpiresAt older than 24 hours', () => {
    const legacyOld = {
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
    };
    assert.equal(isTrackingExpired(legacyOld), true, 'Legacy record older than 24 hours must be expired');
  });

  await t.test('returns false for legacy record without trackingExpiresAt newer than 24 hours', () => {
    const legacyNew = {
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    };
    assert.equal(isTrackingExpired(legacyNew), false, 'Legacy record newer than 24 hours must not be expired');
  });

  await t.test('returns true for null/undefined event', () => {
    assert.equal(isTrackingExpired(null), true);
    assert.equal(isTrackingExpired(undefined), true);
  });
});

test('AUDIT-005: LiveKit room authorization', async (t) => {
  const origKey = process.env.LIVEKIT_API_KEY;
  const origSecret = process.env.LIVEKIT_API_SECRET;
  const origUrl = process.env.LIVEKIT_URL;

  t.after(() => {
    process.env.LIVEKIT_API_KEY = origKey;
    process.env.LIVEKIT_API_SECRET = origSecret;
    process.env.LIVEKIT_URL = origUrl;
  });

  await t.test('returns 503 when LiveKit environment variables are missing', async () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;

    let statusCode = null;
    let jsonBody = null;
    const req = { user: { id: 'user-123', name: 'Test User' }, body: {} };
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; return this; },
    };

    await createLiveKitToken(req, res, (err) => { throw err; });
    assert.equal(statusCode, 503);
    assert.equal(jsonBody.success, false);
    assert.equal(jsonBody.message, 'LiveKit is not configured.');
  });

  await t.test('returns 403 Forbidden when requesting another user room', async () => {
    process.env.LIVEKIT_API_KEY = 'test-api-key';
    process.env.LIVEKIT_API_SECRET = 'test-api-secret-123456789012345678901234';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    let statusCode = null;
    let jsonBody = null;
    const req = {
      user: { id: 'user-123', name: 'Victim' },
      body: { roomName: 'sanket-assistant-user-456' }, // attacker tries to join user 456 room
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; return this; },
    };

    await createLiveKitToken(req, res, (err) => { throw err; });
    assert.equal(statusCode, 403);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /not authorized/i);
  });

  await t.test('returns 200 with server-derived room when room is omitted', async () => {
    process.env.LIVEKIT_API_KEY = 'test-api-key';
    process.env.LIVEKIT_API_SECRET = 'test-api-secret-123456789012345678901234';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    let statusCode = 200;
    let jsonBody = null;
    const req = {
      user: { id: 'user-123', name: 'Victim' },
      body: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; return this; },
    };

    await createLiveKitToken(req, res, (err) => { throw err; });
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.success, true);
    assert.equal(jsonBody.data.roomName, 'sanket-assistant-user-123');
    assert.equal(jsonBody.data.identity, 'user-user-123');
    assert.ok(jsonBody.data.token, 'Token must be issued');

    // Decode token claims to verify grant
    const decoded = jwt.decode(jsonBody.data.token);
    assert.equal(decoded.sub, 'user-user-123');
    assert.equal(decoded.video.room, 'sanket-assistant-user-123');
    assert.equal(decoded.video.roomJoin, true);
  });

  await t.test('returns 200 when explicitly requesting own authorized room', async () => {
    process.env.LIVEKIT_API_KEY = 'test-api-key';
    process.env.LIVEKIT_API_SECRET = 'test-api-secret-123456789012345678901234';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    let statusCode = 200;
    let jsonBody = null;
    const req = {
      user: { id: 'user-123', name: 'Victim' },
      body: { roomName: 'sanket-assistant-user-123' },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; return this; },
    };

    await createLiveKitToken(req, res, (err) => { throw err; });
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.success, true);
    assert.equal(jsonBody.data.roomName, 'sanket-assistant-user-123');
  });
});
