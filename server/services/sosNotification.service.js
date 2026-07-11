const SOSEvent = require('../models/SOSEvent');
const EmergencyContact = require('../models/EmergencyContact');
const User = require('../models/User');
const { sendSOSAlert } = require('./whatsapp.service');
const { makeEmergencyCall } = require('./twilio.service');

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getMaxNotificationAttempts = () => parsePositiveInteger(process.env.SOS_NOTIFICATION_MAX_ATTEMPTS, 3);

const truncateError = (error) => {
  const message = error?.message || String(error || 'Unknown notification error');
  return message.slice(0, 300);
};

const updateNotification = (sosEventId, contactId, update) => {
  return SOSEvent.updateOne(
    { _id: sosEventId, 'notifications.contactId': contactId },
    update
  );
};

const shouldAttemptNotification = (notification) => {
  return (notification?.notificationAttemptCount || 0) < getMaxNotificationAttempts();
};

const dispatchContactNotification = async ({ sosEvent, user, contact, trackingUrl }) => {
  const notification = sosEvent.notifications.find((item) => (
    item.contactId?.toString() === contact._id.toString()
  ));

  if (!notification || !shouldAttemptNotification(notification)) return;

  const attemptStartedAt = new Date();
  const result = {
    whatsappSent: Boolean(notification.whatsappSent),
    whatsappSentAt: notification.whatsappSentAt || null,
    voiceCallSid: notification.voiceCallSid || null,
    voiceCallStatus: notification.voiceCallStatus || null,
    voiceCalledAt: notification.voiceCalledAt || null,
    lastError: null,
  };

  await updateNotification(sosEvent._id, contact._id, {
    $inc: { 'notifications.$.notificationAttemptCount': 1 },
    $set: {
      'notifications.$.notificationLastAttemptAt': attemptStartedAt,
      'notifications.$.notificationLastError': null,
    },
  });

  if (contact.whatsappEnabled !== false && !result.whatsappSent) {
    try {
      const waResult = await sendSOSAlert(contact, user, sosEvent.location, trackingUrl);
      result.whatsappSent = Boolean(waResult.success);
      result.whatsappSentAt = waResult.success ? new Date() : null;
      if (!waResult.success) result.lastError = waResult.error || waResult.reason || 'WhatsApp send failed';
    } catch (error) {
      result.lastError = truncateError(error);
    }
  }

  if (contact.callEnabled !== false && result.voiceCallStatus !== 'queued') {
    try {
      const callResult = await makeEmergencyCall(contact, user, sosEvent.location);
      result.voiceCallSid = callResult.sid || null;
      result.voiceCallStatus = callResult.success ? 'queued' : 'failed';
      result.voiceCalledAt = callResult.success ? new Date() : null;
      if (!callResult.success) result.lastError = callResult.error || callResult.reason || 'Voice call failed';
    } catch (error) {
      result.voiceCallStatus = 'failed';
      result.lastError = truncateError(error);
    }
  }

  await updateNotification(sosEvent._id, contact._id, {
    $set: {
      'notifications.$.whatsappSent': result.whatsappSent,
      'notifications.$.whatsappSentAt': result.whatsappSentAt,
      'notifications.$.voiceCallSid': result.voiceCallSid,
      'notifications.$.voiceCallStatus': result.voiceCallStatus,
      'notifications.$.voiceCalledAt': result.voiceCalledAt,
      'notifications.$.notificationLastError': result.lastError,
    },
  });
};

const dispatchSOSNotifications = async (sosEventId, { trackingUrl } = {}) => {
  const sosEvent = await SOSEvent.findById(sosEventId);
  if (!sosEvent || sosEvent.status !== 'active') return;

  const user = await User.findById(sosEvent.userId);
  if (!user) return;

  const contacts = await EmergencyContact.find({ userId: sosEvent.userId });
  const resolvedTrackingUrl = trackingUrl
    || `${process.env.CLIENT_URL || 'http://localhost:5173'}/track/${sosEvent.trackingId}`;

  const results = await Promise.allSettled(
    contacts.map((contact) => dispatchContactNotification({
      sosEvent,
      user,
      contact,
      trackingUrl: resolvedTrackingUrl,
    }))
  );

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length > 0) {
    console.error(`SOS notification dispatch had ${failed.length} failed contact job(s).`);
  }
};

const recoverPendingSOSNotifications = async () => {
  const activeEvents = await SOSEvent.find({ status: 'active' }).select('_id trackingId');

  await Promise.allSettled(
    activeEvents.map((event) => dispatchSOSNotifications(event._id))
  );
};

module.exports = {
  dispatchSOSNotifications,
  recoverPendingSOSNotifications,
};
