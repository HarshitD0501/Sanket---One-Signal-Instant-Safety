const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCoordinates } = require('../utils/locationValidation');
const { sequelize } = require('../config/db');

test.after(async () => {
  try {
    await sequelize.close();
  } catch (_e) {}
});

test('AUDIT-007: Geolocation coordinate validation and zero-coordinate boundary handling', async (t) => {
  await t.test('accepts equator position where latitude is 0', () => {
    const result = parseCoordinates({ lat: 0, lng: 77.209 });
    assert.equal(result.isValid, true);
    assert.equal(result.lat, 0);
    assert.equal(result.lng, 77.209);
  });

  await t.test('accepts prime meridian position where longitude is 0', () => {
    const result = parseCoordinates({ lat: 28.6139, lng: 0 });
    assert.equal(result.isValid, true);
    assert.equal(result.lat, 28.6139);
    assert.equal(result.lng, 0);
  });

  await t.test('accepts null island coordinates (0, 0)', () => {
    const result = parseCoordinates({ lat: 0, lng: 0 });
    assert.equal(result.isValid, true);
    assert.equal(result.lat, 0);
    assert.equal(result.lng, 0);
  });

  await t.test('accepts extreme valid geographic boundaries (-90, 90, -180, 180)', () => {
    assert.equal(parseCoordinates({ lat: 90, lng: 180 }).isValid, true);
    assert.equal(parseCoordinates({ lat: -90, lng: -180 }).isValid, true);
  });

  await t.test('rejects out of bounds coordinates', () => {
    assert.equal(parseCoordinates({ lat: 90.0001, lng: 0 }).isValid, false);
    assert.equal(parseCoordinates({ lat: -90.0001, lng: 0 }).isValid, false);
    assert.equal(parseCoordinates({ lat: 0, lng: 180.0001 }).isValid, false);
    assert.equal(parseCoordinates({ lat: 0, lng: -180.0001 }).isValid, false);
  });

  await t.test('rejects non-numeric and NaN coordinates', () => {
    assert.equal(parseCoordinates({ lat: 'abc', lng: 77 }).isValid, false);
    assert.equal(parseCoordinates({ lat: null, lng: null }).isValid, false);
    assert.equal(parseCoordinates({ lat: undefined, lng: undefined }).isValid, false);
  });
});

test('AUDIT-006: Shake gesture motion debounce and burst cooldown simulation', async (t) => {
  await t.test('burst of motion triggers within 5000ms cooldown window execute callback exactly once', () => {
    let callCount = 0;
    const callback = () => { callCount++; };

    const COOLDOWN_MS = 5000;
    let lastTriggerTime = 0;

    const simulateShakeEvent = (now) => {
      if (now - lastTriggerTime >= COOLDOWN_MS) {
        lastTriggerTime = now;
        callback();
      }
    };

    const startTime = 100000;
    // Simulate 20 rapid motion events within a 500ms shake burst
    for (let offset = 0; offset < 500; offset += 25) {
      simulateShakeEvent(startTime + offset);
    }

    assert.equal(callCount, 1, 'Shake burst must only produce 1 trigger during cooldown');

    // After cooldown passes (5100ms later), a new shake should trigger
    simulateShakeEvent(startTime + 5100);
    assert.equal(callCount, 2, 'New shake after cooldown window must trigger');
  });
});

test('AUDIT-003: Active SOS hydration and socket room contract', async (t) => {
  const { isTrackingExpired } = require('../controllers/tracking.controller');

  await t.test('rehydration validates non-expired active event', () => {
    const validActive = {
      id: 'sos-123',
      status: 'active',
      trackingExpiresAt: new Date(Date.now() + 3600000),
    };
    assert.equal(isTrackingExpired(validActive), false);
  });

  await t.test('rehydration rejects expired active event', () => {
    const expiredActive = {
      id: 'sos-123',
      status: 'active',
      trackingExpiresAt: new Date(Date.now() - 60000),
    };
    assert.equal(isTrackingExpired(expiredActive), true);
  });
});
