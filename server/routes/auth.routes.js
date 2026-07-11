const router = require('express').Router();
const { register, login, getProfile, updateProfile } = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');
const rateLimit = require('../middleware/rateLimit.middleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth attempts. Please wait and try again.',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);

module.exports = router;
