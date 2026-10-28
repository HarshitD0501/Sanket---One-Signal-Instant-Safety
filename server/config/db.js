const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { Sequelize } = require('sequelize');

// PostgreSQL via Sequelize. Prefer DATABASE_URL; otherwise fall back to PG* vars
// (defaults target a local postgres so dev works with zero config).
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: process.env.PG_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
    })
  : new Sequelize(
      process.env.PGDATABASE || 'sanket',
      process.env.PGUSER || 'postgres',
      process.env.PGPASSWORD || 'postgres',
      {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        dialect: 'postgres',
        logging: false,
      }
    );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    require('../models/associations'); // wire associations before queries

    const isProduction = process.env.NODE_ENV === 'production';
    const autoSync = process.env.DB_AUTO_SYNC === 'true';

    // AUDIT-015: In production, API startup validates connectivity without mutating schema.
    // Production schema changes must be deployed via versioned migrations (`npm run db:migrate`).
    // Development environments can enable auto-sync explicitly via DB_AUTO_SYNC=true.
    if (!isProduction && autoSync) {
      await sequelize.sync();
      console.log('PostgreSQL auto-synced (development)');
    } else {
      console.log('PostgreSQL connected');
    }

    return sequelize;
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`);
    throw error;
  }
};

const isDbReady = async () => {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
};

module.exports = { sequelize, connectDB, isDbReady };
