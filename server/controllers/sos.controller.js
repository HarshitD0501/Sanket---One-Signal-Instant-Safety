const { v4: uuidv4 } = require('uuid');
const SOSEvent = require('../models/SOSEvent');
const SOSNotification = require('../models/SOSNotification');
const LocationPoint = require('../models/LocationPoint');
const EmergencyContact = require('../models/EmergencyContact');
const User = require('../models/User');
const { sendAllClearMessage } = require('../services/whatsapp.service');
const { dispatchSOSNotifications } = require('../services/sosNotification.service');
const { reverseGeocode } = require('../services/maps.service');
const { parseCoordinates } = require('../utils/locationValidation');
const { sequelize } = require('../config/db');

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const TRACKING_LINK_TTL_HOURS = parsePositiveNumber(process.env.TRACKING_LINK_TTL_HOURS, 24);
const RESOLVED_TRACKING_TTL_MINUTES = parsePositiveNumber(process.env.RESOLVED_TRACKING_TTL_MINUTES, 60);

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

// Postgres unique-violation on the partial "one active SOS per user" index.
const isDuplicateActiveSOSError = (error) => (
  error?.name === 'SequelizeUniqueConstraintError'
  && (
    error?.parent?.constraint === 'one_active_sos_per_user'
    || (error?.fields && Object.prototype.hasOwnProperty.call(error.fields, 'userId'))
    || error?.message?.includes('one_active_sos_per_user')
  )
);

const sendActiveSOSConflict = async (res, userId) => {
  const activeSOS = await SOSEvent.findOne({
    where: { userId, status: 'active' },
    attributes: ['trackingId'],
  });

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

    const event = await SOSEvent.findOne({ where: { id: sosEventId, status: 'active' } });
    if (event) {
      event.location = { ...event.location, address };
      await event.save();
    }
  } catch (error) {
    console.warn('SOS address enrichment failed:', error.message);
  }
};

const triggerSOS = async (req, res, next) => {
  try {
    const { triggerType } = req.body;
    const coordinates = parseCoordinates(req.body);

    if (!coordinates.isValid) {
      return res.status(400).json({ success: false, message: coordinates.message });
    }

    const { lat, lng } = coordinates;

    const existingActive = await SOSEvent.findOne({
      where: { userId: req.user.id, status: 'active' },
    });

    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: 'An SOS is already active.',
        data: { trackingId: existingActive.trackingId },
      });
    }

    const contacts = await EmergencyContact.findAll({ where: { userId: req.user.id } });
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

    const sosEvent = await sequelize.transaction(async (transaction) => {
      const event = await SOSEvent.create({
        userId: req.user.id,
        triggerType: triggerType === 'shake' ? 'shake' : 'tap',
        status: 'active',
        location: { lat, lng, address: '' },
        trackingId,
        trackingExpiresAt,
        notifications: contacts.map((contact) => ({
          contactId: contact.id,
          contactName: contact.name,
          contactPhone: contact.phone,
        })),
      }, {
        include: [{ model: SOSNotification, as: 'notifications' }],
        transaction,
      });

      await LocationPoint.create({
        sosEventId: event.id,
        userId: req.user.id,
        lat,
        lng,
        timestamp: new Date(),
      }, { transaction });

      await User.update(
        { sosActive: true, lastKnownLocation: { lat, lng, updatedAt: new Date() } },
        { where: { id: req.user.id }, transaction }
      );

      return event;
    });

    dispatchSOSNotifications(sosEvent.id, { trackingUrl }).catch((error) => {
      console.error('SOS notification dispatch failed:', error.message);
    });

    enrichSOSAddress(sosEvent.id, lat, lng);

    res.status(201).json({
      success: true,
      message: 'SOS triggered. Notifications are being sent.',
      data: {
        sosId: sosEvent.id,
        trackingId,
        trackingUrl,
        trackingExpiresAt,
        location: { lat, lng, address: '' },
        contactsNotified: contacts.length,
      },
    });
  } catch (error) {
    if (isDuplicateActiveSOSError(error)) {
      return sendActiveSOSConflict(res, req.user.id);
    }
    next(error);
  }
};

const resolveSOS = async (req, res, next) => {
  try {
    const sosEvent = await SOSEvent.findOne({
      where: { id: req.params.id, userId: req.user.id, status: 'active' },
    });

    if (!sosEvent) {
      return res.status(404).json({ success: false, message: 'No active SOS found.' });
    }

    const resolvedAt = new Date();
    const newStatus = req.body.status === 'false_alarm' ? 'false_alarm' : 'resolved';
    const newExpiresAt = addMinutes(resolvedAt, RESOLVED_TRACKING_TTL_MINUTES);

    await sequelize.transaction(async (transaction) => {
      sosEvent.status = newStatus;
      sosEvent.resolvedAt = resolvedAt;
      sosEvent.trackingExpiresAt = newExpiresAt;
      await sosEvent.save({ transaction });

      await User.update({ sosActive: false }, { where: { id: req.user.id }, transaction });
    });

    const contacts = await EmergencyContact.findAll({ where: { userId: req.user.id } });
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
        sosId: sosEvent.id,
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
      where: { userId: req.user.id, status: 'active' },
      include: [{ model: SOSNotification, as: 'notifications' }],
    });

    res.json({ success: true, data: activeSOS || null });
  } catch (error) {
    next(error);
  }
};

const getSOSHistory = async (req, res, next) => {
  try {
    const events = await SOSEvent.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20,
      include: [{ model: SOSNotification, as: 'notifications' }],
    });

    res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    next(error);
  }
};

module.exports = { triggerSOS, resolveSOS, getActiveSOS, getSOSHistory };
