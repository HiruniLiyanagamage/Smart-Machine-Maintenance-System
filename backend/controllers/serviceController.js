const pool = require('../models/database');

// Record service
exports.recordService = async (req, res) => {
    try {
        const { machine_id, service_date, service_type, description, performed_by, parts_used, cost } = req.body;
        
        const connection = await pool.getConnection();
        
        // Get machine details
        const [machines] = await connection.query(
            'SELECT service_interval_days FROM machines WHERE machine_id = ?',
            [machine_id]
        );
        
        if (machines.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Machine not found' });
        }
        
        // Calculate next service date
        const nextServiceDate = new Date(service_date);
        nextServiceDate.setDate(nextServiceDate.getDate() + machines[0].service_interval_days);
        
        // Insert service record
        const result = await connection.query(
            'INSERT INTO service_history (machine_id, service_date, service_type, description, performed_by, parts_used, cost, next_service_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [machine_id, service_date, service_type, description, performed_by, parts_used, cost, nextServiceDate]
        );
        
        // Update machine next service date
        await connection.query(
            'UPDATE machines SET last_service_date = ?, next_service_date = ? WHERE machine_id = ?',
            [service_date, nextServiceDate, machine_id]
        );
        
        // Get machine info for notification
        const [machineInfo] = await connection.query('SELECT machine_name FROM machines WHERE machine_id = ?', [machine_id]);
        
        // Create notifications for admins
        const [admins] = await connection.query("SELECT user_id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
            await connection.query(
                'INSERT INTO notifications (user_id, type, title, message, related_machine_id) VALUES (?, ?, ?, ?, ?)',
                [admin.user_id, 'service_reminder', 'Service Recorded', `Service recorded for machine "${machineInfo[0].machine_name}". Next service: ${nextServiceDate.toISOString().split('T')[0]}`, machine_id]
            );
        }
        
        connection.release();
        
        res.status(201).json({ 
            service_id: result[0].insertId, 
            next_service_date: nextServiceDate.toISOString().split('T')[0],
            message: 'Service recorded successfully' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get service history for machine
exports.getServiceHistory = async (req, res) => {
    try {
        const { machine_id } = req.params;
        const connection = await pool.getConnection();
        
        const [services] = await connection.query(
            'SELECT sh.*, u.username as performed_by_name FROM service_history sh LEFT JOIN users u ON sh.performed_by = u.user_id WHERE sh.machine_id = ? ORDER BY sh.service_date DESC',
            [machine_id]
        );
        connection.release();
        
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all services
exports.getAllServices = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [services] = await connection.query(
            'SELECT sh.*, m.machine_code, m.machine_name, u.username as performed_by_name FROM service_history sh JOIN machines m ON sh.machine_id = m.machine_id LEFT JOIN users u ON sh.performed_by = u.user_id ORDER BY sh.service_date DESC'
        );
        connection.release();
        
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single service
exports.getServiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        const [services] = await connection.query(
            'SELECT sh.*, m.machine_code, m.machine_name, u.username as performed_by_name FROM service_history sh JOIN machines m ON sh.machine_id = m.machine_id LEFT JOIN users u ON sh.performed_by = u.user_id WHERE sh.service_id = ?',
            [id]
        );
        connection.release();
        
        if (services.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        res.json(services[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update service
exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { service_date, service_type, description, performed_by, parts_used, cost, next_service_date } = req.body;
        
        const connection = await pool.getConnection();
        
        await connection.query(
            'UPDATE service_history SET service_date = ?, service_type = ?, description = ?, performed_by = ?, parts_used = ?, cost = ?, next_service_date = ? WHERE service_id = ?',
            [service_date, service_type, description, performed_by, parts_used, cost, next_service_date, id]
        );
        
        connection.release();
        
        res.json({ message: 'Service updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete service
exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        await connection.query('DELETE FROM service_history WHERE service_id = ?', [id]);
        connection.release();
        
        res.json({ message: 'Service deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get upcoming services (next 7 days)
exports.getUpcomingServices = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [services] = await connection.query(`
            SELECT m.machine_id, m.machine_code, m.machine_name, m.next_service_date 
            FROM machines m
            WHERE m.next_service_date IS NOT NULL 
            AND m.next_service_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            AND m.next_service_date >= CURDATE()
            ORDER BY m.next_service_date
        `);
        connection.release();
        
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get overdue services
exports.getOverdueServices = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [services] = await connection.query(`
            SELECT m.machine_id, m.machine_code, m.machine_name, m.next_service_date, DATEDIFF(CURDATE(), m.next_service_date) as days_overdue
            FROM machines m
            WHERE m.next_service_date < CURDATE()
            ORDER BY m.next_service_date
        `);
        connection.release();
        
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
