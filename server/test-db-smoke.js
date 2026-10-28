// End-to-end DB smoke test for the Postgres migration.
// WARNING: This script uses sequelize.sync({ force: true }) which DROPS ALL EXISTING TABLES!
// It must ONLY be run against an isolated, disposable test database.
// Requires explicit environment flag: ALLOW_DESTRUCTIVE_DB_TEST=true
const assert = require('assert');

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_DB_TEST !== 'true') {
  console.error('\n================================================================');
  console.error('SAFETY BLOCKED: server/test-db-smoke.js');
  console.error('This script executes sequelize.sync({ force: true }) which DROPS');
  console.error('ALL TABLES in the target database.');
  console.error('To run this test on an ISOLATED, DISPOSABLE database:');
  console.error('  1. Verify DATABASE_URL points to a dedicated disposable DB.');
  console.error('  2. Set ALLOW_DESTRUCTIVE_DB_TEST=true in your environment.');
  console.error('  3. Never run in production (NODE_ENV=production is blocked).');
  console.error('================================================================\n');
  process.exit(1);
}

const { sequelize } = require('./config/db');
const { User, EmergencyContact, SOSEvent, SOSNotification, LocationPoint } = require('./models/associations');

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true }); // clean schema for the test
  console.log('connected + schema synced');

  // 1. Register-equivalent: password hashed by hook, comparePassword works.
  const user = await User.create({ name: 'Asha', email: 'ASHA@Test.com ', password: 'secret123', phone: '9876543210' });
  assert.equal(user.email, 'asha@test.com', 'email lowercased/trimmed');
  assert.notEqual(user.password, 'secret123', 'password hashed');
  assert.ok(await user.comparePassword('secret123'), 'comparePassword true');
  assert.ok(!(await user.comparePassword('wrong')), 'wrong password false');
  assert.equal(user._id, user.id, '_id alias works');
  assert.equal(user.toJSON().password, undefined, 'password not serialized');

  // 2. Contacts
  const c1 = await EmergencyContact.create({ userId: user.id, name: 'Mom', phone: '9000000001', relation: 'Mother' });
  await EmergencyContact.create({ userId: user.id, name: 'Bro', phone: '9000000002', relation: 'Sibling' });
  assert.equal(await EmergencyContact.countByUser(user.id), 2, 'countByUser');

  // 3. SOS with notification children in one create
  const contacts = await EmergencyContact.findAll({ where: { userId: user.id } });
  const sos = await SOSEvent.create({
    userId: user.id, triggerType: 'tap', status: 'active',
    location: { lat: 28.61, lng: 77.20, address: '' },
    trackingId: '11111111-1111-4111-8111-111111111111',
    trackingExpiresAt: new Date(Date.now() + 3600e3),
    notifications: contacts.map((c) => ({ contactId: c.id, contactName: c.name, contactPhone: c.phone })),
  }, { include: [{ model: SOSNotification, as: 'notifications' }] });
  const notifCount = await SOSNotification.count({ where: { sosEventId: sos.id } });
  assert.equal(notifCount, 2, 'notification child rows created');

  // 4. Partial unique index: a second ACTIVE sos for same user must fail
  let dup = false;
  try {
    await SOSEvent.create({ userId: user.id, triggerType: 'tap', status: 'active',
      location: { lat: 1, lng: 1, address: '' }, trackingId: '22222222-2222-4222-8222-222222222222',
      trackingExpiresAt: new Date(Date.now() + 3600e3) });
  } catch (e) { dup = e.name === 'SequelizeUniqueConstraintError'; }
  assert.ok(dup, 'second active SOS blocked by partial unique index');

  // 5. Per-contact notification update (no array race)
  await SOSNotification.increment('notificationAttemptCount', { by: 1, where: { sosEventId: sos.id, contactId: c1.id } });
  const n1 = await SOSNotification.findOne({ where: { sosEventId: sos.id, contactId: c1.id } });
  assert.equal(n1.notificationAttemptCount, 1, 'attempt counter incremented for one contact only');

  // 6. Location points
  await LocationPoint.create({ sosEventId: sos.id, userId: user.id, lat: 28.61, lng: 77.20 });
  await LocationPoint.create({ sosEventId: sos.id, userId: user.id, lat: 28.62, lng: 77.21 });
  const pts = await LocationPoint.findAll({ where: { sosEventId: sos.id }, order: [['timestamp', 'ASC']] });
  assert.equal(pts.length, 2, 'location points appended');

  // 7. Resolve → now a new active SOS is allowed
  sos.status = 'resolved'; sos.resolvedAt = new Date(); await sos.save();
  await SOSEvent.create({ userId: user.id, triggerType: 'shake', status: 'active',
    location: { lat: 2, lng: 2, address: '' }, trackingId: '33333333-3333-4333-8333-333333333333',
    trackingExpiresAt: new Date(Date.now() + 3600e3) });
  assert.equal(await SOSEvent.count({ where: { userId: user.id, status: 'active' } }), 1, 'exactly one active after re-trigger');

  console.log('DB SMOKE TEST: PASS ✅');
  await sequelize.close();
})().catch(async (e) => {
  console.error('DB SMOKE TEST FAILED:', e.message);
  await sequelize.close();
  process.exit(1);
});
