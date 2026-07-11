const EmergencyContact = require('../models/EmergencyContact');

const MAX_CONTACTS = 5;

/**
 * GET /api/contacts
 */
const getContacts = async (req, res, next) => {
  try {
    const contacts = await EmergencyContact.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
};

const allowedRelations = ['Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Other'];
const cleanRelation = (rel) => {
  if (!rel) return 'Other';
  const found = allowedRelations.find(
    (r) => r.toLowerCase() === rel.trim().toLowerCase()
  );
  return found || 'Other';
};

/**
 * POST /api/contacts
 */
const addContact = async (req, res, next) => {
  try {
    // Check max contacts limit
    const count = await EmergencyContact.countByUser(req.user._id);
    if (count >= MAX_CONTACTS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CONTACTS} emergency contacts allowed.`,
      });
    }

    const { name, phone, relation, whatsappEnabled, callEnabled } = req.body;

    const contact = await EmergencyContact.create({
      userId: req.user._id,
      name,
      phone,
      relation: cleanRelation(relation),
      whatsappEnabled: whatsappEnabled !== false,
      callEnabled: callEnabled !== false,
    });

    res.status(201).json({
      success: true,
      message: 'Emergency contact added.',
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/contacts/:id
 */
const updateContact = async (req, res, next) => {
  try {
    const contact = await EmergencyContact.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found.',
      });
    }

    const allowedFields = ['name', 'phone', 'relation', 'whatsappEnabled', 'callEnabled'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'relation') {
          contact[field] = cleanRelation(req.body[field]);
        } else {
          contact[field] = req.body[field];
        }
      }
    });

    await contact.save();

    res.json({
      success: true,
      message: 'Contact updated.',
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/contacts/:id
 */
const deleteContact = async (req, res, next) => {
  try {
    const contact = await EmergencyContact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found.',
      });
    }

    res.json({
      success: true,
      message: 'Contact removed.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getContacts, addContact, updateContact, deleteContact };
