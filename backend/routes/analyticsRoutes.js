const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const pool = require('../models/database');

// Get dashboard statistics
router.get('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [totalMachines] = await connection.query('SELECT COUNT(*) as count FROM machines');
        const [activeMachines] = await connection.query("SELECT COUNT(*) as count FROM machines WHERE status = 'active'");
        const [overdueServices] = await connection.query("SELECT COUNT(*) as count FROM machines WHERE next_service_date < CURDATE()");
        const [lowStockParts] = await connection.query('SELECT COUNT(*) as count FROM spare_parts WHERE quantity_in_stock <= reorder_level');
        const [openBreakdowns] = await connection.query("SELECT COUNT(*) as count FROM breakdown_reports WHERE status != 'closed'");
        
        connection.release();
        
        res.json({
            totalMachines: totalMachines[0].count,
            activeMachines: activeMachines[0].count,
            overdueServices: overdueServices[0].count,
            lowStockParts: lowStockParts[0].count,
            openBreakdowns: openBreakdowns[0].count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
