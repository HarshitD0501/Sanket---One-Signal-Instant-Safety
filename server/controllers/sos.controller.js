const { v4: uuidv4 } = require('uuid');
const SOSEvent = require('../models/SOSEvent');
const EmergencyContact = require('../models/EmergencyContact');
const LocationHistory = require('../models/LocationHistory');
const User = require('../models/User');
const { sendAllClearMessage } = require('../services/whatsapp.service');
const { dispatchSOSNotifications } = require('../services/sosNotification.service');
const { reverseGeocode } = require('../services/maps.service');
const { parseCoordinates } = require('../utils/locationValidation');

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const TRACKING_LINK_TTL_HOURS = parsePositiveNumber(process.env.TRACKING_LINK_TTL_HOURS, 24);
const RESOLVED_TRACKING_TTL_MINUTES = parsePositiveNumber(process.env.RESOLVED_TRACKING_TTL_MINUTES, 60);

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const isDuplicateActiveSOSError = (error) => (
  error?.code === 11000
  && (
    error?.keyPattern?.userId
    || error?.keyValue?.status === 'active'
    || error?.message?.includes('one_active_sos_per_user')
  )
);

const sendActiveSOSConflict = async (res, userId) => {
  const activeSOS = await SOSEvent.findOne({
    userId,
    status: 'active',
  }).select('trackingId');

  return res.status(400).json({
    success: false,
    message: 'An SOS is already active.',
    data: activeSOS ? { trackingId: activeSOS.trackingId } : undefined,
  });
};

const enrichSOSAddress = async (sosEventId, lat, lng) => {
  try {
    const address = await reverseGeocode(lat, lng);
    if (!address) return;

    await SOSEvent.updateOne(
      { _id: sosEventId, status: 'active' },
      { $set: { 'location.address': address } }
    );
  } catch (error) {
    console.warn('SOS address enrichment failed:', error.message);
  }
};

const triggerSOS = async (req, res, next) => {
  try {
    const { triggerType } = req.body;
    const coordinates = parseCoordinates(req.body);

    if (!coordinates.isValid) {
      return res.status(400).json({
        success: false,
        message: coordinates.message,
      });
    }

    const { lat, lng } = coordinates;

    const existingActive = await SOSEvent.findOne({
      userId: req.user._id,
      status: 'active',
    });

    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: 'An SOS is already active.',
        data: { trackingId: existingActive.trackingId },
      });
    }

    const contacts = await EmergencyContact.find({ userId: req.user._id });
    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No emergency contacts found. Please add at least one contact.',
      });
    }

    const trackingId = uuidv4();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const trackingUrl = `${clientUrl}/track/${trackingId}`;
    const trackingExpiresAt = addHours(new Date(), TRACKING_LINK_TTL_HOURS);

    const sosEvent = await SOSEvent.create({
      userId: req.user._id,
      triggerType: triggerType || 'tap',
      status: 'active',
      location: { lat, lng, address: '' },
      trackingId,
      trackingExpiresAt,
      notifications: contacts.map((contact) => ({
        contactId: contact._id,
        contactName: contact.name,
        contactPhone: contact.phone,
      })),
    });

    await LocationHistory.create({
      sosEventId: sosEvent._id,
      userId: req.user._id,
      coordinates: [{ lat, lng, timestamp: new Date() }],
    });

    await User.findByIdAndUpdate(req.user._id, {
      sosActive: true,
      lastKnownLocation: { lat, lng, updatedAt: new Date() },
    });

    dispatchSOSNotifications(sosEvent._id, { trackingUrl }).catch((error) => {
      console.error('SOS notification dispatch failed:', error.message);
    });

    enrichSOSAddress(sosEvent._id, lat, lng);

    res.status(201).json({
      success: true,
      message: 'SOS triggered. Notifications are being sent.',
      data: {
        sosId: sosEvent._id,
        trackingId,
        trackingUrl,
        trackingExpiresAt,
        location: { lat, lng, address: '' },
        contactsNotified: contacts.length,
      },
    });
  } catch (error) {
    if (isDuplicateActiveSOSError(error)) {
      return sendActiveSOSConflict(res, req.user._id);
    }

    next(error);
  }
};

const resolveSOS = async (req, res, next) => {
  try {
    const sosEvent = await SOSEvent.findOne({
      _id: req.params.id,
      userId: req.user._id,
      status: 'active',
    });

    if (!sosEvent) {
      return res.status(404).json({
        success: false,
        message: 'No active SOS found.',
      });
    }

    const resolvedAt = new Date();
    sosEvent.status = req.body.status === 'false_alarm' ? 'false_alarm' : 'resolved';
    sosEvent.resolvedAt = resolvedAt;
    sosEvent.trackingExpiresAt = addMinutes(resolvedAt, RESOLVED_TRACKING_TTL_MINUTES);
    await sosEvent.save();

    await User.findByIdAndUpdate(req.user._id, { sosActive: false });

    const contacts = await EmergencyContact.find({ userId: req.user._id });
    contacts.forEach((contact) => {
      if (contact.whatsappEnabled) {
        sendAllClearMessage(contact, req.user).catch((error) => {
          console.error(`All-clear message failed for ${contact.name}:`, error.message);
        });
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`sos-${sosEvent.trackingId}`).emit('sos-ended', {
        message: 'SOS has been resolved. The user is safe.',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'SOS resolved. All-clear messages are being sent.',
      data: {
        sosId: sosEvent._id,
        status: sosEvent.status,
        resolvedAt: sosEvent.resolvedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getActiveSOS = async (req, res, next) => {
  try {
    const activeSOS = await SOSEvent.findOne({
      userId: req.user._id,
      status: 'active',
    });

    res.json({
      success: true,
      data: activeSOS || null,
    });
  } catch (error) {
    next(error);
  }
};

const getSOSHistory = async (req, res, next) => {
  try {
    const events = await SOSEvent.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { triggerSOS, resolveSOS, getActiveSOS, getSOSHistory };
