const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// GET endpoints
router.get('/', authenticate, serviceController.getAllServices);
router.get('/upcoming', authenticate, serviceController.getUpcomingServices);
router.get('/overdue', authenticate, serviceController.getOverdueServices);
router.get('/machine/:machine_id', authenticate, serviceController.getServiceHistory);
router.get('/:id', authenticate, serviceController.getServiceById);

// POST - Record service (Admin only)
router.post('/', authenticate, authorize('admin'), serviceController.recordService);

// PUT - Update service (Admin only)
router.put('/:id', authenticate, authorize('admin'), serviceController.updateService);

// DELETE - Delete service (Admin only)
router.delete('/:id', authenticate, authorize('admin'), serviceController.deleteService);

module.exports = router;
