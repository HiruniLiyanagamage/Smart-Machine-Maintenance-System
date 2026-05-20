const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Accessible to all authenticated users
router.get('/', authenticate, machineController.getAllMachines);
router.get('/status', authenticate, machineController.getMachineStatus);
router.get('/status-detail', authenticate, machineController.getMachinesWithStatus);
router.get('/:id', authenticate, machineController.getMachineById);

// Admin only
router.post('/', authenticate, authorize('admin'), machineController.createMachine);
router.put('/:id', authenticate, authorize('admin'), machineController.updateMachine);
router.delete('/:id', authenticate, authorize('admin'), machineController.deleteMachine);

module.exports = router;
