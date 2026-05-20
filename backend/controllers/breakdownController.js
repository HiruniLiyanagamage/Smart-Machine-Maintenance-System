const pool = require('../models/database');

// Report breakdown
exports.reportBreakdown = async (req, res) => {
    try {
        const { machine_id, description, severity } = req.body;
        
        const connection = await pool.getConnection();
        
        // Get machine info
        const [machines] = await connection.query(
            'SELECT machine_name FROM machines WHERE machine_id = ?',
            [machine_id]
        );
        
        if (machines.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Machine not found' });
        }
        
        const result = await connection.query(
            'INSERT INTO breakdown_reports (machine_id, reported_by, description, severity) VALUES (?, ?, ?, ?)',
            [machine_id, req.user.user_id, description, severity || 'medium']
        );
        
        // Update machine status
        await connection.query(
            'UPDATE machines SET status = ? WHERE machine_id = ?',
            ['breakdown', machine_id]
        );
        
        // Create notifications for admins
        const [admins] = await connection.query("SELECT user_id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
            await connection.query(
                'INSERT INTO notifications (user_id, type, title, message, related_machine_id) VALUES (?, ?, ?, ?, ?)',
                [admin.user_id, 'breakdown_alert', 'Breakdown Reported', `Machine "${machines[0].machine_name}" has been reported with ${severity} severity. Description: ${description.substring(0, 50)}...`, machine_id]
            );
        }
        
        connection.release();
        
        res.status(201).json({ breakdown_id: result[0].insertId, message: 'Breakdown reported successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all breakdown reports
exports.getAllBreakdowns = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [breakdowns] = await connection.query(`
            SELECT 
                br.*,
                m.machine_code,
                m.machine_name,
                u1.username as reported_by_name,
                u1.first_name as reported_by_first_name,
                u1.last_name as reported_by_last_name,
                u2.username as assigned_to_name,
                u2.first_name as assigned_to_first_name,
                u2.last_name as assigned_to_last_name
            FROM breakdown_reports br
            JOIN machines m ON br.machine_id = m.machine_id
            LEFT JOIN users u1 ON br.reported_by = u1.user_id
            LEFT JOIN users u2 ON br.assigned_to = u2.user_id
            ORDER BY br.report_date DESC
        `);
        connection.release();
        
        res.json(breakdowns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get breakdown by ID
exports.getBreakdownById = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        const [breakdowns] = await connection.query(`
            SELECT 
                br.*,
                m.machine_code,
                m.machine_name,
                u1.username as reported_by_name,
                u2.username as assigned_to_name
            FROM breakdown_reports br
            JOIN machines m ON br.machine_id = m.machine_id
            LEFT JOIN users u1 ON br.reported_by = u1.user_id
            LEFT JOIN users u2 ON br.assigned_to = u2.user_id
            WHERE br.breakdown_id = ?
        `, [id]);
        
        connection.release();
        
        if (breakdowns.length === 0) {
            return res.status(404).json({ error: 'Breakdown not found' });
        }
        
        res.json(breakdowns[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get breakdowns by machine
exports.getBreakdownsByMachine = async (req, res) => {
    try {
        const { machine_id } = req.params;
        const connection = await pool.getConnection();
        
        const [breakdowns] = await connection.query(`
            SELECT 
                br.*,
                u1.username as reported_by_name,
                u2.username as assigned_to_name
            FROM breakdown_reports br
            LEFT JOIN users u1 ON br.reported_by = u1.user_id
            LEFT JOIN users u2 ON br.assigned_to = u2.user_id
            WHERE br.machine_id = ?
            ORDER BY br.report_date DESC
        `, [machine_id]);
        
        connection.release();
        
        res.json(breakdowns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update breakdown status
exports.updateBreakdownStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to, resolution_notes } = req.body;
        
        const connection = await pool.getConnection();
        
        // Get breakdown details
        const [breakdowns] = await connection.query(
            'SELECT * FROM breakdown_reports WHERE breakdown_id = ?',
            [id]
        );
        
        if (breakdowns.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Breakdown not found' });
        }
        
        const resolved_date = (status === 'resolved' || status === 'closed') ? new Date() : null;
        
        // Update breakdown
        await connection.query(
            'UPDATE breakdown_reports SET status = ?, assigned_to = ?, resolution_notes = ?, resolved_date = ? WHERE breakdown_id = ?',
            [status, assigned_to, resolution_notes, resolved_date, id]
        );
        
        // If resolved/closed, update machine status back to active
        if (status === 'resolved' || status === 'closed') {
            await connection.query(
                'UPDATE machines SET status = ? WHERE machine_id = ?',
                ['active', breakdowns[0].machine_id]
            );
        }
        
        connection.release();
        
        res.json({ message: 'Breakdown updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get breakdown statistics
exports.getBreakdownStats = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [stats] = await connection.query(`
            SELECT 
                COUNT(*) as total_breakdowns,
                SUM(CASE WHEN status = 'reported' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count
            FROM breakdown_reports
        `);
        
        connection.release();
        
        res.json(stats[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete breakdown
exports.deleteBreakdown = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        await connection.query('DELETE FROM breakdown_reports WHERE breakdown_id = ?', [id]);
        connection.release();
        
        res.json({ message: 'Breakdown deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
