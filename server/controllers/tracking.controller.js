const SOSEvent = require('../models/SOSEvent');
const LocationHistory = require('../models/LocationHistory');
const User = require('../models/User');
const { parseCoordinates } = require('../utils/locationValidation');

const isTrackingExpired = (sosEvent) => (
  sosEvent.status !== 'active'
  && (!sosEvent.trackingExpiresAt || sosEvent.trackingExpiresAt <= new Date())
);

/**
 * GET /api/tracking/:trackingId — PUBLIC (no auth)
 * Returns SOS info + latest location for the public tracking page
 */
const getTrackingData = async (req, res, next) => {
  try {
    const { trackingId } = req.params;

    const sosEvent = await SOSEvent.findOne({ trackingId })
      .populate('userId', 'name phone');

    if (!sosEvent) {
      return res.status(404).json({
        success: false,
        message: 'Tracking link not found or expired.',
      });
    }

    if (isTrackingExpired(sosEvent)) {
      return res.status(404).json({
        success: false,
        message: 'Tracking link not found or expired.',
      });
    }

    // Get location history
    const locationHistory = await LocationHistory.findOne({
      sosEventId: sosEvent._id,
    });
    const isActive = sosEvent.status === 'active';

    res.json({
      success: true,
      data: {
        trackingId: sosEvent.trackingId,
        userName: sosEvent.userId?.name || 'Unknown',
        status: sosEvent.status,
        triggerType: sosEvent.triggerType,
        location: sosEvent.location,
        coordinates: isActive ? locationHistory?.coordinates || [] : [],
        triggeredAt: sosEvent.createdAt,
        resolvedAt: sosEvent.resolvedAt,
        trackingExpiresAt: sosEvent.trackingExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tracking/update-location — AUTH REQUIRED
 * Push GPS coordinates during active SOS
 */
const updateLocation = async (req, res, next) => {
  try {
    const coordinates = parseCoordinates(req.body);

    if (!coordinates.isValid) {
      return res.status(400).json({
        success: false,
        message: coordinates.message,
      });
    }

    const { lat, lng } = coordinates;

    // Find active SOS
    const activeSOS = await SOSEvent.findOne({
      userId: req.user._id,
      status: 'active',
    });

    if (!activeSOS) {
      return res.status(400).json({
        success: false,
        message: 'No active SOS found.',
      });
    }

    // Append to location history
    await LocationHistory.findOneAndUpdate(
      { sosEventId: activeSOS._id },
      {
        $push: {
          coordinates: { lat, lng, timestamp: new Date() },
        },
      }
    );

    // Update user's last known location
    await User.findByIdAndUpdate(req.user._id, {
      lastKnownLocation: { lat, lng, updatedAt: new Date() },
    });

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`sos-${activeSOS.trackingId}`).emit('location-updated', {
        lat,
        lng,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTrackingData, updateLocation };
