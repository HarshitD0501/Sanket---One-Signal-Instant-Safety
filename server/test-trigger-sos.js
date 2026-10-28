// OBSOLETE / HISTORICAL SCRIPT:
// This diagnostic was written for the legacy MongoDB/Mongoose prototype and has the ability
// to dispatch live emergency alerts via WhatsApp/Twilio.
// Current architecture uses PostgreSQL managed with Sequelize.
console.error('\n================================================================');
console.error('SAFETY BLOCKED: server/test-trigger-sos.js');
console.error('This is an obsolete MongoDB prototype script and is disabled.');
console.error('The active database is PostgreSQL managed via Sequelize.');
console.error('Do not use this script with live emergency contacts or providers.');
console.error('See CODEBASE_REMEDIATION_PLAN.md for safe testing workflows.');
console.error('================================================================\n');
process.exit(1);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('./models/User');
const EmergencyContact = require('./models/EmergencyContact');
const SOSEvent = require('./models/SOSEvent');
const LocationHistory = require('./models/LocationHistory');
const { dispatchSOSNotifications } = require('./services/sosNotification.service');

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);

const getArg = (name) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const run = async () => {
  const userId = process.env.TEST_SOS_USER_ID || getArg('userId');
  const lat = Number(process.env.TEST_LAT || getArg('lat') || 26.8467);
  const lng = Number(process.env.TEST_LNG || getArg('lng') || 80.9462);
  const shouldSend = process.env.TEST_SEND_NOTIFICATIONS === 'true' || process.argv.includes('--send');

  if (!userId) {
    console.error('Provide TEST_SOS_USER_ID or --userId=<mongo-user-id>.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const user = await User.findById(userId);
  if (!user) throw new Error(`User ${userId} not found.`);

  const existingActive = await SOSEvent.findOne({ userId: user._id, status: 'active' });
  if (existingActive) {
    throw new Error(`User already has active SOS ${existingActive._id}. Resolve it before running this diagnostic.`);
  }

  const contacts = await EmergencyContact.find({ userId: user._id });
  if (contacts.length === 0) throw new Error('No emergency contacts found for this user.');

  const trackingId = uuidv4();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const trackingUrl = `${clientUrl}/track/${trackingId}`;

  const sosEvent = await SOSEvent.create({
    userId: user._id,
    triggerType: 'tap',
    status: 'active',
    location: {
      lat,
      lng,
      address: process.env.TEST_ADDRESS || 'Diagnostic test location',
    },
    trackingId,
    trackingExpiresAt: addHours(new Date(), Number(process.env.TRACKING_LINK_TTL_HOURS || 24)),
    notifications: contacts.map((contact) => ({
      contactId: contact._id,
      contactName: contact.name,
      contactPhone: contact.phone,
    })),
  });

  await LocationHistory.create({
    sosEventId: sosEvent._id,
    userId: user._id,
    coordinates: [{ lat, lng, timestamp: new Date() }],
  });

  console.log(`Created diagnostic SOS ${sosEvent._id} with tracking id ${trackingId}.`);

  if (shouldSend) {
    console.log('Sending notifications because --send or TEST_SEND_NOTIFICATIONS=true was provided.');
    await dispatchSOSNotifications(sosEvent._id, { trackingUrl });
  } else {
    console.log('Notifications were not sent. Pass --send to dispatch them.');
  }
};

run()
  .catch((error) => {
    console.error('SOS diagnostic failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
