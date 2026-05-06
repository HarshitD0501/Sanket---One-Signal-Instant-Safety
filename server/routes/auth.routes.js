const router = require('express').Router();
const { register, login, getProfile, updateProfile } = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);

module.exports = router;
