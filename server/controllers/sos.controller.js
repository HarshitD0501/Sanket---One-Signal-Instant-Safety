const { v4: uuidv4 } = require('uuid');
const SOSEvent = require('../models/SOSEvent');
const EmergencyContact = require('../models/EmergencyContact');
const LocationHistory = require('../models/LocationHistory');
const User = require('../models/User');
const { sendSOSAlert, sendAllClearMessage } = require('../services/whatsapp.service');
const { makeEmergencyCall } = require('../services/twilio.service');
const { reverseGeocode } = require('../services/maps.service');

/**
 * POST /api/sos/trigger
 * Core SOS trigger — sends WhatsApp + Voice calls to all contacts
 */
const triggerSOS = async (req, res, next) => {
  try {
    const { triggerType, lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Location (lat, lng) is required to trigger SOS.',
      });
    }

    // Check if user already has an active SOS
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

    // Get user's emergency contacts
    const contacts = await EmergencyContact.find({ userId: req.user._id });
    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No emergency contacts found. Please add at least one contact.',
      });
    }

    // Reverse geocode address
    const address = await reverseGeocode(lat, lng);

    // Generate unique tracking ID
    const trackingId = uuidv4();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const trackingUrl = `${clientUrl}/track/${trackingId}`;

    // Create SOS event
    const sosEvent = await SOSEvent.create({
      userId: req.user._id,
      triggerType: triggerType || 'tap',
      status: 'active',
      location: { lat, lng, address },
      trackingId,
      notifications: contacts.map((c) => ({
        contactId: c._id,
        contactName: c.name,
        contactPhone: c.phone,
      })),
    });

    // Create location history
    await LocationHistory.create({
      sosEventId: sosEvent._id,
      userId: req.user._id,
      coordinates: [{ lat, lng, timestamp: new Date() }],
    });

    // Update user's SOS status and last known location
    await User.findByIdAndUpdate(req.user._id, {
      sosActive: true,
      lastKnownLocation: { lat, lng, updatedAt: new Date() },
    });

    // Send notifications in parallel (non-blocking)
    const notificationPromises = contacts.map(async (contact) => {
      const results = { contactId: contact._id };

      // WhatsApp alert
      if (contact.whatsappEnabled) {
        const waResult = await sendSOSAlert(contact, req.user, { lat, lng, address }, trackingUrl);
        results.whatsappSent = waResult.success;
        results.whatsappSentAt = waResult.success ? new Date() : null;
      }

      // Voice call
      if (contact.callEnabled) {
        const callResult = await makeEmergencyCall(contact.phone, req.user.name, address, trackingUrl);
        results.voiceCallSid = callResult.callSid || null;
        results.voiceCallStatus = callResult.success ? 'queued' : 'failed';
        results.voiceCalledAt = callResult.success ? new Date() : null;
      }

      return results;
    });

    // Execute all notifications (don't block response)
    Promise.all(notificationPromises).then(async (notifResults) => {
      // Update SOS event with notification results
      for (const result of notifResults) {
        await SOSEvent.updateOne(
          { _id: sosEvent._id, 'notifications.contactId': result.contactId },
          {
            $set: {
              'notifications.$.whatsappSent': result.whatsappSent || false,
              'notifications.$.whatsappSentAt': result.whatsappSentAt,
              'notifications.$.voiceCallSid': result.voiceCallSid,
              'notifications.$.voiceCallStatus': result.voiceCallStatus,
              'notifications.$.voiceCalledAt': result.voiceCalledAt,
            },
          }
        );
      }
      console.log(`🚨 SOS notifications sent for tracking: ${trackingId}`);
    }).catch((err) => {
      console.error('❌ Notification error:', err.message);
    });

    res.status(201).json({
      success: true,
      message: '🚨 SOS triggered! Notifications being sent.',
      data: {
        sosId: sosEvent._id,
        trackingId,
        trackingUrl,
        location: { lat, lng, address },
        contactsNotified: contacts.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/sos/:id/resolve
 */
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

    // Mark as resolved
    sosEvent.status = req.body.status === 'false_alarm' ? 'false_alarm' : 'resolved';
    sosEvent.resolvedAt = new Date();
    await sosEvent.save();

    // Update user's SOS status
    await User.findByIdAndUpdate(req.user._id, { sosActive: false });

    // Send "all clear" WhatsApp messages
    const contacts = await EmergencyContact.find({ userId: req.user._id });
    contacts.forEach((contact) => {
      if (contact.whatsappEnabled) {
        sendAllClearMessage(contact, req.user).catch((err) => {
          console.error(`❌ All-clear message failed for ${contact.name}:`, err.message);
        });
      }
    });

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.to(`sos-${sosEvent.trackingId}`).emit('sos-ended', {
        message: 'SOS has been resolved. The user is safe.',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: '✅ SOS resolved. All-clear messages being sent.',
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

/**
 * GET /api/sos/active
 */
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

/**
 * GET /api/sos/history
 */
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
