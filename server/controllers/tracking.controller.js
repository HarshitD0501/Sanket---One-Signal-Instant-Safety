const SOSEvent = require('../models/SOSEvent');
const LocationPoint = require('../models/LocationPoint');
const User = require('../models/User');
const { parseCoordinates } = require('../utils/locationValidation');

const isTrackingExpired = (sosEvent) => {
  if (!sosEvent) return true;
  if (!sosEvent.trackingExpiresAt) {
    const createdAt = new Date(sosEvent.createdAt || Date.now()).getTime();
    return createdAt + 24 * 60 * 60 * 1000 <= Date.now();
  }
  return new Date(sosEvent.trackingExpiresAt).getTime() <= Date.now();
};

/**
 * GET /api/tracking/:trackingId — PUBLIC (no auth)
 * Returns SOS info + latest location for the public tracking page
 */
const getTrackingData = async (req, res, next) => {
  try {
    const { trackingId } = req.params;

    const sosEvent = await SOSEvent.findOne({
      where: { trackingId },
      include: [{ model: User, as: 'user', attributes: ['name', 'phone'] }],
    });

    if (!sosEvent || isTrackingExpired(sosEvent)) {
      return res.status(404).json({
        success: false,
        message: 'Tracking link not found or expired.',
      });
    }

    const MAX_TRAIL_POINTS = 500;
    const isActive = sosEvent.status === 'active';
    const points = isActive
      ? (await LocationPoint.findAll({
          where: { sosEventId: sosEvent.id },
          order: [['timestamp', 'DESC']],
          limit: MAX_TRAIL_POINTS,
          attributes: ['lat', 'lng', 'timestamp'],
        })).reverse()
      : [];

    res.json({
      success: true,
      data: {
        trackingId: sosEvent.trackingId,
        userName: sosEvent.user?.name || 'Unknown',
        status: sosEvent.status,
        triggerType: sosEvent.triggerType,
        location: sosEvent.location,
        coordinates: points.map((p) => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })),
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
      return res.status(400).json({ success: false, message: coordinates.message });
    }

    const { lat, lng } = coordinates;

    const activeSOS = await SOSEvent.findOne({
      where: { userId: req.user.id, status: 'active' },
    });

    if (!activeSOS) {
      return res.status(400).json({ success: false, message: 'No active SOS found.' });
    }

    await LocationPoint.create({
      sosEventId: activeSOS.id,
      userId: req.user.id,
      lat,
      lng,
      timestamp: new Date(),
    });

    await User.update(
      { lastKnownLocation: { lat, lng, updatedAt: new Date() } },
      { where: { id: req.user.id } }
    );

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

const MAX_TRAIL_POINTS = 500;

module.exports = { getTrackingData, updateLocation, isTrackingExpired, MAX_TRAIL_POINTS };
