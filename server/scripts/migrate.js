const path = require('path');
const fs = require('fs');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

async function ensureMigrationTable(seq) {
  const queryInterface = seq.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('schema_migrations')) {
    await queryInterface.createTable('schema_migrations', {
      version: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      executed_at: {
        type: DataTypes.DATE,
        defaultValue: seq.fn('NOW'),
      },
    });
    console.log('Created schema_migrations table.');
  }
}

async function getExecutedMigrations(seq) {
  const [results] = await seq.query('SELECT version FROM schema_migrations ORDER BY version ASC;');
  return new Set(results.map((r) => r.version));
}

async function runMigrations(seq = sequelize) {
  await seq.authenticate();
  await ensureMigrationTable(seq);

  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    return { applied: [] };
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  const executed = await getExecutedMigrations(seq);
  const applied = [];

  for (const file of files) {
    const version = file.split('_')[0];
    if (executed.has(version)) {
      continue;
    }

    console.log(`Running migration: ${file}...`);
    const migration = require(path.join(migrationsDir, file));

    const transaction = await seq.transaction();
    try {
      await migration.up(seq.getQueryInterface(), seq.constructor);
      await seq.query(
        'INSERT INTO schema_migrations (version, name, executed_at) VALUES (:version, :name, NOW());',
        {
          replacements: { version, name: file },
          transaction,
        }
      );
      await transaction.commit();
      console.log(`✅ Applied migration: ${file}`);
      applied.push(file);
    } catch (err) {
      await transaction.rollback();
      console.error(`❌ Migration failed: ${file}`, err);
      throw err;
    }
  }

  if (applied.length === 0) {
    console.log('Database is up to date. No pending migrations.');
  } else {
    console.log(`Successfully applied ${applied.length} migration(s).`);
  }

  return { applied };
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations, ensureMigrationTable };
