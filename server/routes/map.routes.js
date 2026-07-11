const router = require('express').Router();
const { getNearbyPlaces } = require('../services/maps.service');
const auth = require('../middleware/auth.middleware');
const rateLimit = require('../middleware/rateLimit.middleware');
const { parseCoordinates, parseRadius } = require('../utils/locationValidation');

const mapLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many map requests. Please wait a moment and try again.',
});

/**
 * GET /api/map/safe-zones/:lat/:lng
 */
router.get('/safe-zones/:lat/:lng', auth, mapLimiter, async (req, res, next) => {
  try {
    const coordinates = parseCoordinates(req.params);
    if (!coordinates.isValid) {
      return res.status(400).json({
        success: false,
        message: coordinates.message,
      });
    }

    const radius = parseRadius(req.query.radius, {
      defaultValue: 5000,
      min: 100,
      max: 50000,
    });

    if (radius === null) {
      return res.status(400).json({
        success: false,
        message: 'Radius must be a number between 100 and 50000 meters.',
      });
    }

    const safeZones = await getNearbyPlaces(
      coordinates.lat,
      coordinates.lng,
      radius
    );

    res.json({
      success: true,
      data: safeZones,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
