const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { chatWithAssistant } = require('../controllers/assistant.controller');
const { createLiveKitToken } = require('../controllers/livekit.controller');
const auth = require('../middleware/auth.middleware');
const User = require('../models/User');
const { sequelize } = require('../config/db');

test.after(async () => {
  try {
    await sequelize.close();
  } catch (_e) {}
});

// Helper to create mock Express req/res
const createMockReqRes = ({
  body = {},
  headers = {},
  user = null,
} = {}) => {
  const req = {
    body,
    headers,
    user,
    header(name) {
      return this.headers[name.toLowerCase()];
    },
  };
  const res = {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
    set(key, val) {
      return this.setHeader(key, val);
    },
  };
  return { req, res };
};

test('AUDIT-013: Assistant and Voice endpoint authentication boundaries', async (t) => {
  await t.test('auth middleware rejects unauthenticated assistant requests with 401', async () => {
    const { req, res } = createMockReqRes({ headers: {} });
    let nextCalled = false;
    await auth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false, 'Next must not be called without auth');
    assert.equal(res.statusCode, 401);
    assert.equal(res._json.success, false);
    assert.match(res._json.message, /no token provided/i);
  });

  await t.test('auth middleware rejects malformed or invalid JWT with 401', async () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: 'Bearer invalid.token.value' },
    });
    let nextCalled = false;
    await auth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res._json.success, false);
    assert.match(res._json.message, /invalid token/i);
  });

  await t.test('auth middleware allows valid JWT with authenticated user context', async () => {
    const secret = 'test-jwt-secret-for-unit-tests';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;

    const origFindByPk = User.findByPk;
    User.findByPk = async (id) => ({ id, name: 'Verified User' });

    try {
      const token = jwt.sign({ id: 'user-auth-123' }, secret, { expiresIn: '1h' });
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      let nextCalled = false;
      await auth(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, 'Next must be called with valid token');
      assert.ok(req.user, 'req.user must be populated');
      assert.equal(req.user.id, 'user-auth-123');
    } finally {
      User.findByPk = origFindByPk;
      process.env.JWT_SECRET = originalSecret;
    }
  });
});

test('TASK-008 & AUDIT-013: Assistant controller validation contracts', async (t) => {
  await t.test('rejects empty or whitespace-only messages with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { message: '   ' },
      user: { id: 'u1' },
    });

    await chatWithAssistant(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'Message is required.');
  });

  await t.test('rejects message exceeding MAX_MESSAGE_LENGTH (2000 chars) with 400', async () => {
    const longMessage = 'A'.repeat(2001);
    const { req, res } = createMockReqRes({
      body: { message: longMessage },
      user: { id: 'u1' },
    });

    await chatWithAssistant(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.match(res._json.message, /cannot exceed 2000 characters/i);
  });

  await t.test('rejects non-array history parameter with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { message: 'Hello', history: 'invalid-string-history' },
      user: { id: 'u1' },
    });

    await chatWithAssistant(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'History must be an array.');
  });
});

test('TASK-008: LiveKit voice endpoint graceful service availability', async (t) => {
  const origKey = process.env.LIVEKIT_API_KEY;
  const origSecret = process.env.LIVEKIT_API_SECRET;
  const origUrl = process.env.LIVEKIT_URL;

  t.after(() => {
    process.env.LIVEKIT_API_KEY = origKey;
    process.env.LIVEKIT_API_SECRET = origSecret;
    process.env.LIVEKIT_URL = origUrl;
  });

  await t.test('returns 503 without crashing when LiveKit credentials are not configured', async () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;

    const { req, res } = createMockReqRes({
      body: {},
      user: { id: 'user-789', name: 'Test' },
    });

    await createLiveKitToken(req, res, (err) => { throw err; });

    assert.equal(res.statusCode, 503);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'LiveKit is not configured.');
  });

  await t.test('enforces that authenticated users can only join their own private room', async () => {
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret-must-be-long-enough-for-signing';
    process.env.LIVEKIT_URL = 'wss://livekit.example.com';

    const { req, res } = createMockReqRes({
      body: { roomName: 'sanket-assistant-other-user' },
      user: { id: 'user-my-id', name: 'Test' },
    });

    await createLiveKitToken(req, res, (err) => { throw err; });

    assert.equal(res.statusCode, 403);
    assert.equal(res._json.success, false);
    assert.match(res._json.message, /not authorized/i);
  });
});
