const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../config/db');

test.after(async () => {
  try {
    await sequelize.close();
  } catch (_e) {}
});

test('AUDIT-015: Versioned migrations and production schema sync guard', async (t) => {
  await t.test('migration file exists and exports up and down functions', () => {
    const migrationPath = path.resolve(__dirname, '..', 'migrations', '20261028_01_init_schema.js');
    assert.ok(fs.existsSync(migrationPath), 'Baseline migration must exist');

    const migration = require(migrationPath);
    assert.equal(typeof migration.up, 'function', 'migration must have up()');
    assert.equal(typeof migration.down, 'function', 'migration must have down()');
  });

  await t.test('migration creates all 5 application tables with required constraints', async () => {
    const migration = require('../migrations/20261028_01_init_schema');
    const createdTables = [];
    const createdIndexes = [];

    const mockQueryInterface = {
      createTable: async (tableName, schema) => {
        createdTables.push({ tableName, schema });
      },
      addIndex: async (tableName, fields, options) => {
        createdIndexes.push({ tableName, fields, options });
      },
      dropTable: async () => {},
    };

    const mockSequelize = {
      fn: () => 'NOW()',
    };

    await migration.up(mockQueryInterface, mockSequelize);

    const tableNames = createdTables.map((t) => t.tableName);
    assert.ok(tableNames.includes('users'), 'users table must be created');
    assert.ok(tableNames.includes('emergency_contacts'), 'emergency_contacts table must be created');
    assert.ok(tableNames.includes('sos_events'), 'sos_events table must be created');
    assert.ok(tableNames.includes('sos_notifications'), 'sos_notifications table must be created');
    assert.ok(tableNames.includes('location_points'), 'location_points table must be created');

    // Verify partial unique index on active SOS (AUDIT-001 / AUDIT-015)
    const activeIndex = createdIndexes.find(
      (idx) => idx.tableName === 'sos_events' && idx.options?.name === 'one_active_sos_per_user'
    );
    assert.ok(activeIndex, 'one_active_sos_per_user partial unique index must exist');
    assert.equal(activeIndex.options.unique, true);
    assert.deepEqual(activeIndex.options.where, { status: 'active' });
  });

  await t.test('production environment prevents implicit sequelize.sync()', async () => {
    const origEnv = process.env.NODE_ENV;
    const origSync = process.env.DB_AUTO_SYNC;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DB_AUTO_SYNC;

      const { connectDB, sequelize } = require('../config/db');

      let syncCalled = false;
      const origSyncMethod = sequelize.sync;
      sequelize.sync = async () => { syncCalled = true; };
      const origAuth = sequelize.authenticate;
      sequelize.authenticate = async () => true;

      try {
        await connectDB();
        assert.equal(syncCalled, false, 'In production, connectDB must NOT call sequelize.sync()');
      } finally {
        sequelize.sync = origSyncMethod;
        sequelize.authenticate = origAuth;
      }
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.DB_AUTO_SYNC = origSync;
    }
  });
});

test('AUDIT-011: Package manifest and documentation reconciliation', async (t) => {
  await t.test('package.json specifies test and db:migrate scripts', () => {
    const pkg = require('../package.json');
    assert.ok(pkg.scripts.test, 'npm test script must be declared');
    assert.ok(pkg.scripts['db:migrate'], 'npm run db:migrate must be declared');
    assert.ok(pkg.scripts.start, 'npm start must be declared');
  });

  await t.test('.env.example specifies all required provider and database keys', () => {
    const envExamplePath = path.resolve(__dirname, '..', '..', '.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const content = fs.readFileSync(envExamplePath, 'utf8');

    // Confirm essential env keys are documented
    const requiredKeys = [
      'DATABASE_URL',
      'JWT_SECRET',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'TWILIO_ACCOUNT_SID',
      'LIVEKIT_URL',
      'GEMINI_API_KEY',
    ];

    for (const key of requiredKeys) {
      assert.ok(content.includes(key), `.env.example must document ${key}`);
    }
  });
});
