const pool = require('../models/database');

// Get all machines
exports.getAllMachines = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [machines] = await connection.query(
            'SELECT * FROM machines ORDER BY machine_code'
        );
        connection.release();
        
        res.json(machines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single machine
exports.getMachineById = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        const [machines] = await connection.query(
            'SELECT * FROM machines WHERE machine_id = ?',
            [id]
        );
        connection.release();
        
        if (machines.length === 0) {
            return res.status(404).json({ error: 'Machine not found' });
        }
        
        res.json(machines[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create machine
exports.createMachine = async (req, res) => {
    try {
        const { machine_code, machine_name, description, model, manufacturer, purchase_date, location, service_interval_days } = req.body;
        
        const connection = await pool.getConnection();
        // Calculate initial next service date based on purchase_date and interval
        let nextServiceDate = null;
        const intervalDays = service_interval_days || 30;
        if (purchase_date) {
            const d = new Date(purchase_date);
            d.setDate(d.getDate() + intervalDays);
            nextServiceDate = d.toISOString().split('T')[0];
        }

        const result = await connection.query(
            'INSERT INTO machines (machine_code, machine_name, description, model, manufacturer, purchase_date, location, service_interval_days, next_service_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [machine_code, machine_name, description, model, manufacturer, purchase_date, location, intervalDays, nextServiceDate]
        );
        connection.release();
        
        res.status(201).json({ machine_id: result[0].insertId, message: 'Machine created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update machine
exports.updateMachine = async (req, res) => {
    try {
        const { id } = req.params;
        const { machine_name, description, model, manufacturer, location, service_interval_days, status } = req.body;
        
        const connection = await pool.getConnection();
        await connection.query(
            'UPDATE machines SET machine_name = ?, description = ?, model = ?, manufacturer = ?, location = ?, service_interval_days = ?, status = ? WHERE machine_id = ?',
            [machine_name, description, model, manufacturer, location, service_interval_days, status, id]
        );
        connection.release();
        
        res.json({ message: 'Machine updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete machine
exports.deleteMachine = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        await connection.query('DELETE FROM machines WHERE machine_id = ?', [id]);
        connection.release();
        
        res.json({ message: 'Machine deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get machine status with service status
exports.getMachineStatus = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const today = new Date().toISOString().split('T')[0];
        
        const [status] = await connection.query(`
            SELECT 
                machine_id,
                machine_name,
                machine_code,
                status,
                next_service_date,
                CASE 
                    WHEN next_service_date IS NULL THEN 'New'
                    WHEN next_service_date > ? THEN 'OK'
                    WHEN DATE_ADD(next_service_date, INTERVAL -7 DAY) <= ? AND next_service_date > ? THEN 'Service Soon'
                    ELSE 'Overdue'
                END as service_status
            FROM machines
            ORDER BY machine_name`,
            [today, today, today]
        );
        connection.release();
        
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get machine with service status
exports.getMachinesWithStatus = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const today = new Date().toISOString().split('T')[0];
        
        const [machines] = await connection.query(`
            SELECT 
                *,
                CASE 
                    WHEN next_service_date IS NULL THEN 'New'
                    WHEN next_service_date > ? THEN 'OK'
                    WHEN DATE_ADD(next_service_date, INTERVAL -7 DAY) <= ? AND next_service_date > ? THEN 'Service Soon'
                    ELSE 'Overdue'
                END as service_status
            FROM machines
            ORDER BY machine_code`,
            [today, today, today]
        );
        connection.release();
        
        res.json(machines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// OLD: Get machine status
exports.getMachineStatusOld = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [status] = await connection.query(`
            SELECT 
                machine_id,
                machine_name,
                CASE 
                    WHEN next_service_date IS NULL THEN 'New'
                    WHEN DATEDIFF(next_service_date, CURDATE()) <= 0 THEN 'Overdue'
                    WHEN DATEDIFF(next_service_date, CURDATE()) <= 7 THEN 'Service Soon'
                    ELSE 'OK'
                END as service_status,
                next_service_date,
                status
            FROM machines
            ORDER BY machine_code
        `);
        connection.release();
        
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
