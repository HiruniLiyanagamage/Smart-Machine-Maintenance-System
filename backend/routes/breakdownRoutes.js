const express = require('express');
const router = express.Router();
const breakdownController = require('../controllers/breakdownController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// GET endpoints
router.get('/', authenticate, breakdownController.getAllBreakdowns);
router.get('/stats', authenticate, authorize('admin'), breakdownController.getBreakdownStats);
router.get('/machine/:machine_id', authenticate, breakdownController.getBreakdownsByMachine);
router.get('/:id', authenticate, breakdownController.getBreakdownById);

// POST - Report breakdown (All users)
router.post('/', authenticate, breakdownController.reportBreakdown);

// PUT - Update breakdown status (Admin only)
router.put('/:id', authenticate, authorize('admin'), breakdownController.updateBreakdownStatus);

// DELETE - Delete breakdown (Admin only)
router.delete('/:id', authenticate, authorize('admin'), breakdownController.deleteBreakdown);

module.exports = router;
