const router = require('express').Router();
const { getNearbyPlaces } = require('../services/maps.service');
const auth = require('../middleware/auth.middleware');

/**
 * GET /api/map/safe-zones/:lat/:lng
 */
router.get('/safe-zones/:lat/:lng', auth, async (req, res, next) => {
  try {
    const { lat, lng } = req.params;
    const radius = req.query.radius || 5000;

    const safeZones = await getNearbyPlaces(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius)
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
