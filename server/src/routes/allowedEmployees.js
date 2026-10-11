const express = require('express');
const { body, param, query } = require('express-validator');
const AllowedEmployee = require('../models/AllowedEmployee');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { parsePagination, paginationMeta } = require('../utils/paginate');

const router = express.Router();

// GET /api/admin/allowed-employees
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ uid: searchRegex }, { location: searchRegex }];
    }
    if (req.query.location) {
      filter.location = new RegExp(`^${req.query.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    const total = await AllowedEmployee.countDocuments(filter);
    const employees = await AllowedEmployee.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('addedBy', 'name employeeId');

    const locations = await AllowedEmployee.distinct('location');

    res.json({ employees, locations, pagination: paginationMeta(total, page, limit) });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/admin/allowed-employees — add single
router.post('/', protect, adminOnly, [
  body('uid').isString().trim().isLength({ min: 1, max: 50 }).withMessage('UID is required (max 50 chars)'),
  body('name').optional().isString().trim().isLength({ max: 100 }).withMessage('Name must be under 100 chars'),
  body('location').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Location is required (max 100 chars)'),
], handleValidationErrors, async (req, res) => {
  try {
    const { uid, name, location } = req.body;
    const existing = await AllowedEmployee.findOne({ uid: uid.toUpperCase() });
    if (existing) {
      return res.status(409).json({ message: `UID ${uid.toUpperCase()} already exists in the allowed list` });
    }
    const entry = await AllowedEmployee.create({ uid, name: name || '', location, addedBy: req.employee._id });
    res.status(201).json({ entry });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// POST /api/admin/allowed-employees/bulk — bulk upload
router.post('/bulk', protect, adminOnly, [
  body('entries').isArray({ min: 1, max: 10000 }).withMessage('Entries must be an array (max 10000)'),
  body('entries.*.uid').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each entry must have a valid UID'),
  body('entries.*.location').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Each entry must have a valid location'),
], handleValidationErrors, async (req, res) => {
  try {
    const { entries } = req.body;
    let added = 0;
    let skipped = 0;
    const duplicates = [];
    const errors = [];

    for (const entry of entries) {
      try {
        const existing = await AllowedEmployee.findOne({ uid: entry.uid.toUpperCase() });
        if (existing) {
          skipped++;
          duplicates.push({ uid: entry.uid.toUpperCase(), name: entry.name || '', location: entry.location });
          continue;
        }
        await AllowedEmployee.create({ uid: entry.uid, name: entry.name || '', location: entry.location, addedBy: req.employee._id });
        added++;
      } catch (e) {
        errors.push({ uid: entry.uid, error: e.message });
      }
    }

    res.status(201).json({ added, skipped, duplicates: duplicates.slice(0, 100), errors: errors.length, errorDetails: errors.slice(0, 20), total: entries.length });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// DELETE /api/admin/allowed-employees/:id
router.delete('/:id', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid ID'),
], handleValidationErrors, async (req, res) => {
  try {
    const entry = await AllowedEmployee.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json({ message: 'Entry removed from allowed list' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// DELETE /api/admin/allowed-employees/bulk/delete — bulk delete by location
router.post('/bulk/delete', protect, adminOnly, [
  body('ids').isArray({ min: 1 }).withMessage('IDs array is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const result = await AllowedEmployee.deleteMany({ _id: { $in: req.body.ids } });
    res.json({ deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// GET /api/admin/allowed-employees/check/:uid — check if a UID is allowed
router.get('/check/:uid', protect, adminOnly, async (req, res) => {
  try {
    const entry = await AllowedEmployee.findOne({ uid: req.params.uid.toUpperCase(), isActive: true });
    res.json({ allowed: !!entry, entry });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
