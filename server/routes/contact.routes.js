const router = require('express').Router();
const { getContacts, addContact, updateContact, deleteContact } = require('../controllers/contact.controller');
const auth = require('../middleware/auth.middleware');

// All contact routes require authentication
router.use(auth);

router.get('/', getContacts);
router.post('/', addContact);
router.patch('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;
