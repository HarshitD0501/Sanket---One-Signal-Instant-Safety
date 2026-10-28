const test = require('node:test');
const assert = require('node:assert/strict');
const rateLimit = require('../middleware/rateLimit.middleware');
const errorMiddleware = require('../middleware/error.middleware');
const { sequelize } = require('../config/db');

test.after(async () => {
  try {
    await sequelize.close();
  } catch (_e) {}
});

// Helper to create mock Express req/res
const createMockReqRes = ({ ip = '127.0.0.1', user = null, headers = {} } = {}) => {
  const req = {
    ip,
    user,
    headers,
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

test('AUDIT-012: Rate limit middleware instance isolation and bucket safety', async (t) => {
  await t.test('independent rateLimit instances maintain isolated bucket maps', () => {
    const limiterA = rateLimit({ windowMs: 60000, max: 2, name: 'limiter-a' });
    const limiterB = rateLimit({ windowMs: 60000, max: 2, name: 'limiter-b' });

    let nextACalls = 0;
    let nextBCalls = 0;
    const nextA = () => { nextACalls++; };
    const nextB = () => { nextBCalls++; };

    const { req: req1, res: res1 } = createMockReqRes({ ip: '10.0.0.1' });
    const { req: req2, res: res2 } = createMockReqRes({ ip: '10.0.0.1' });
    const { req: req3, res: res3 } = createMockReqRes({ ip: '10.0.0.1' });

    // Request 1 and 2 to Limiter A succeed
    limiterA(req1, res1, nextA);
    limiterA(req2, res2, nextA);
    assert.equal(nextACalls, 2);

    // Request 3 to Limiter A is rate-limited (429)
    limiterA(req3, res3, nextA);
    assert.equal(nextACalls, 2); // next not called
    assert.equal(res3.statusCode, 429);
    assert.equal(res3._json.success, false);

    // Same IP to Limiter B should still have full quota (isolated bucket map)
    const { req: reqB1, res: resB1 } = createMockReqRes({ ip: '10.0.0.1' });
    limiterB(reqB1, resB1, nextB);
    assert.equal(nextBCalls, 1);
    assert.equal(resB1.statusCode, 200);
  });

  await t.test('authenticates users under separate keys than anonymous IP', () => {
    const limiter = rateLimit({ windowMs: 60000, max: 1 });
    let nextCount = 0;
    const next = () => { nextCount++; };

    const { req: reqUser, res: resUser } = createMockReqRes({ ip: '192.168.1.1', user: { id: 'user-abc' } });
    const { req: reqAnon, res: resAnon } = createMockReqRes({ ip: '192.168.1.1', user: null });

    // Exhaust user quota
    limiter(reqUser, resUser, next);
    assert.equal(nextCount, 1);

    // Same IP without auth user should not be exhausted
    limiter(reqAnon, resAnon, next);
    assert.equal(nextCount, 2);
    assert.equal(resAnon.statusCode, 200);
  });

  await t.test('prunes expired buckets when exceeding maxBuckets', () => {
    const limiter = rateLimit({ windowMs: 20, max: 5, maxBuckets: 2 });
    let nextCount = 0;
    const next = () => { nextCount++; };

    // Fill with client 1 and client 2
    limiter(createMockReqRes({ ip: '1.1.1.1' }).req, createMockReqRes().res, next);
    limiter(createMockReqRes({ ip: '1.1.1.2' }).req, createMockReqRes().res, next);
    assert.equal(limiter.getBucketCount(), 2);

    // Wait 30ms for entries to expire
    const start = Date.now();
    while (Date.now() - start < 30) {
      // Busy wait for clock tick
    }

    // Adding a 3rd client triggers pruning because size was >= maxBuckets
    limiter(createMockReqRes({ ip: '1.1.1.3' }).req, createMockReqRes().res, next);

    // The expired 1.1.1.1 and 1.1.1.2 buckets must be pruned, leaving only 1.1.1.3
    assert.equal(limiter.getBucketCount(), 1);
  });

  await t.test('evicts oldest bucket when maxBuckets is exceeded and entries are active', () => {
    const limiter = rateLimit({ windowMs: 60000, max: 5, maxBuckets: 2 });
    let nextCount = 0;
    const next = () => { nextCount++; };

    limiter(createMockReqRes({ ip: '1.1.1.1' }).req, createMockReqRes().res, next);
    limiter(createMockReqRes({ ip: '1.1.1.2' }).req, createMockReqRes().res, next);
    assert.equal(limiter.getBucketCount(), 2);

    // 3rd client triggers eviction of oldest (1.1.1.1)
    limiter(createMockReqRes({ ip: '1.1.1.3' }).req, createMockReqRes().res, next);
    assert.equal(limiter.getBucketCount(), 2);
  });

  await t.test('sets integer Retry-After header on 429 response', () => {
    const limiter = rateLimit({ windowMs: 30000, max: 1 });
    const { req: r1, res: s1 } = createMockReqRes({ ip: '2.2.2.2' });
    const { req: r2, res: s2 } = createMockReqRes({ ip: '2.2.2.2' });
    limiter(r1, s1, () => {});
    limiter(r2, s2, () => {});

    assert.equal(s2.statusCode, 429);
    const retryAfter = s2.headers['retry-after'];
    assert.ok(retryAfter, 'Retry-After header must be set');
    const seconds = parseInt(retryAfter, 10);
    assert.ok(seconds >= 1 && seconds <= 30);
  });
});

test('AUDIT-009: Endpoint rate limits on tracking routes', async (t) => {
  const trackingRoutes = require('../routes/tracking.routes');
  const getRoute = trackingRoutes.stack.find((s) => s.route && s.route.path === '/:trackingId' && s.route.methods.get);
  assert.ok(getRoute, 'GET /:trackingId route must exist');
  assert.equal(getRoute.route.stack.length, 2, 'GET /:trackingId should have rate limiter and controller');

  const postRoute = trackingRoutes.stack.find((s) => s.route && s.route.path === '/update-location' && s.route.methods.post);
  assert.ok(postRoute, 'POST /update-location route must exist');
  assert.equal(postRoute.route.stack.length, 3, 'POST /update-location should have auth, rate limiter, and controller');
});

test('AUDIT-014: Error middleware status handling and 5xx redaction', async (t) => {
  await t.test('redacts 500 error messages and generates correlation errorId', () => {
    const { req, res } = createMockReqRes();
    const sensitiveErr = new Error('Database connection failed: postgres://admin:secretPass@localhost/sanket');

    errorMiddleware(sensitiveErr, req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'Internal Server Error');
    assert.ok(typeof res._json.errorId === 'string' && res._json.errorId.length > 0);
    // Crucial: sensitive credential must NOT be leaked in client response
    assert.ok(!JSON.stringify(res._json).includes('secretPass'));
  });

  await t.test('preserves safe 4xx client errors without errorId', () => {
    const { req, res } = createMockReqRes();
    const clientErr = new Error('Invalid GPS coordinates');
    clientErr.statusCode = 400;

    errorMiddleware(clientErr, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'Invalid GPS coordinates');
    assert.equal(res._json.errorId, undefined);
  });

  await t.test('formats SequelizeValidationError as 400 with validation details', () => {
    const { req, res } = createMockReqRes();
    const valErr = new Error('Validation failed');
    valErr.name = 'SequelizeValidationError';
    valErr.errors = [{ message: 'Phone must be a valid 10-digit number' }];

    errorMiddleware(valErr, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'Validation failed');
    assert.deepEqual(res._json.errors, ['Phone must be a valid 10-digit number']);
  });

  await t.test('formats SequelizeUniqueConstraintError as 400 with path info', () => {
    const { req, res } = createMockReqRes();
    const uniqueErr = new Error('Unique constraint');
    uniqueErr.name = 'SequelizeUniqueConstraintError';
    uniqueErr.errors = [{ path: 'email' }];

    errorMiddleware(uniqueErr, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.match(res._json.message, /email already exists/i);
  });

  await t.test('formats SequelizeDatabaseError as 400 with safe generic message', () => {
    const { req, res } = createMockReqRes();
    const dbErr = new Error('invalid input syntax for type uuid: "not-a-uuid"');
    dbErr.name = 'SequelizeDatabaseError';

    errorMiddleware(dbErr, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res._json.success, false);
    assert.equal(res._json.message, 'Invalid request data.');
  });
});
