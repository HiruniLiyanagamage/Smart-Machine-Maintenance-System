const express = require('express');
const router = express.Router();
const partsController = require('../controllers/partsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// GET endpoints
router.get('/', authenticate, partsController.getAllParts);
router.get('/low-stock', authenticate, partsController.getLowStockItems);
router.get('/summary', authenticate, partsController.getInventorySummary);
router.get('/category/:category', authenticate, partsController.getPartsByCategory);
router.get('/:id', authenticate, partsController.getPartById);

// POST - Create part (Admin only)
router.post('/', authenticate, authorize('admin'), partsController.createPart);

// PUT - Update part (Admin only)
router.put('/:id', authenticate, authorize('admin'), partsController.updatePart);

// PUT - Update inventory (Admin only)
router.put('/:id/inventory', authenticate, authorize('admin'), partsController.updatePartInventory);

// DELETE - Delete part (Admin only)
router.delete('/:id', authenticate, authorize('admin'), partsController.deletePart);

module.exports = router;
