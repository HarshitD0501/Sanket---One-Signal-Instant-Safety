const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');
const EmergencyContact = require('./models/EmergencyContact');
const SOSEvent = require('./models/SOSEvent');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const maskPhone = (phone = '') => {
  const text = String(phone);
  if (text.length <= 4) return '****';
  return `${'*'.repeat(Math.max(text.length - 4, 0))}${text.slice(-4)}`;
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const users = await User.find({}).select('_id name phone sosActive').limit(20);
    console.log(`\nUsers (${users.length}, showing up to 20)`);
    users.forEach((user) => {
      console.log(`- ${user._id} | ${user.name} | phone=${maskPhone(user.phone)} | sosActive=${user.sosActive}`);
    });

    const contacts = await EmergencyContact.find({}).select('_id userId name phone whatsappEnabled callEnabled').limit(20);
    console.log(`\nEmergency contacts (${contacts.length}, showing up to 20)`);
    contacts.forEach((contact) => {
      console.log(`- ${contact._id} | user=${contact.userId} | ${contact.name} | phone=${maskPhone(contact.phone)} | whatsapp=${contact.whatsappEnabled} | call=${contact.callEnabled}`);
    });

    const activeSOS = await SOSEvent.find({ status: 'active' })
      .select('_id userId trackingId createdAt notifications')
      .limit(20);
    console.log(`\nActive SOS events (${activeSOS.length}, showing up to 20)`);
    activeSOS.forEach((event) => {
      console.log(`- ${event._id} | user=${event.userId} | tracking=${event.trackingId} | created=${event.createdAt} | notifications=${event.notifications.length}`);
    });

    const recentSOS = await SOSEvent.find({})
      .sort({ createdAt: -1 })
      .select('_id userId status trackingId createdAt')
      .limit(5);
    console.log('\nRecent SOS events');
    recentSOS.forEach((event) => {
      console.log(`- ${event._id} | user=${event.userId} | status=${event.status} | tracking=${event.trackingId} | created=${event.createdAt}`);
    });
  } catch (error) {
    console.error('DB diagnostic failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
