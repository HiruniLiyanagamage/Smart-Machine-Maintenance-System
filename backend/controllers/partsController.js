const pool = require('../models/database');

// Get all spare parts
exports.getAllParts = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [parts] = await connection.query(
            'SELECT * FROM spare_parts ORDER BY part_code'
        );
        connection.release();
        
        res.json(parts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single part
exports.getPartById = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        const [parts] = await connection.query(
            'SELECT * FROM spare_parts WHERE part_id = ?',
            [id]
        );
        connection.release();
        
        if (parts.length === 0) {
            return res.status(404).json({ error: 'Part not found' });
        }
        
        res.json(parts[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create spare part
exports.createPart = async (req, res) => {
    try {
        const { part_code, part_name, description, category, unit_price, quantity_in_stock, reorder_level, reorder_quantity, supplier } = req.body;
        
        const connection = await pool.getConnection();
        const result = await connection.query(
            'INSERT INTO spare_parts (part_code, part_name, description, category, unit_price, quantity_in_stock, reorder_level, reorder_quantity, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [part_code, part_name, description, category, unit_price, quantity_in_stock || 0, reorder_level || 5, reorder_quantity || 10, supplier]
        );
        connection.release();
        
        res.status(201).json({ part_id: result[0].insertId, message: 'Part created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update part
exports.updatePart = async (req, res) => {
    try {
        const { id } = req.params;
        const { part_name, description, category, unit_price, reorder_level, reorder_quantity, supplier } = req.body;
        
        const connection = await pool.getConnection();
        await connection.query(
            'UPDATE spare_parts SET part_name = ?, description = ?, category = ?, unit_price = ?, reorder_level = ?, reorder_quantity = ?, supplier = ? WHERE part_id = ?',
            [part_name, description, category, unit_price, reorder_level, reorder_quantity, supplier, id]
        );
        connection.release();
        
        res.json({ message: 'Part updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update part inventory
exports.updatePartInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity_in_stock } = req.body;
        
        const connection = await pool.getConnection();
        
        // Get part details
        const [parts] = await connection.query('SELECT * FROM spare_parts WHERE part_id = ?', [id]);
        if (parts.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Part not found' });
        }
        
        const part = parts[0];
        
        // Update inventory
        await connection.query(
            'UPDATE spare_parts SET quantity_in_stock = ?, last_restocked_date = CURDATE() WHERE part_id = ?',
            [quantity_in_stock, id]
        );
        
        // Create notification if low stock
        if (quantity_in_stock <= part.reorder_level) {
            // Get admin users
            const [admins] = await connection.query("SELECT user_id FROM users WHERE role = 'admin'");
            for (const admin of admins) {
                await connection.query(
                    'INSERT INTO notifications (user_id, type, title, message, related_part_id) VALUES (?, ?, ?, ?, ?)',
                    [admin.user_id, 'low_stock', 'Low Stock Alert', `Part "${part.part_name}" is running low on stock (${quantity_in_stock} units)`, id]
                );
            }
        }
        
        connection.release();
        res.json({ message: 'Inventory updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete part
exports.deletePart = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await pool.getConnection();
        
        await connection.query('DELETE FROM spare_parts WHERE part_id = ?', [id]);
        connection.release();
        
        res.json({ message: 'Part deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get low stock items
exports.getLowStockItems = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [parts] = await connection.query(
            'SELECT * FROM spare_parts WHERE quantity_in_stock <= reorder_level ORDER BY quantity_in_stock'
        );
        connection.release();
        
        res.json(parts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get parts by category
exports.getPartsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const connection = await pool.getConnection();
        const [parts] = await connection.query(
            'SELECT * FROM spare_parts WHERE category = ? ORDER BY part_code',
            [category]
        );
        connection.release();
        
        res.json(parts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get inventory summary
exports.getInventorySummary = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [summary] = await connection.query(`
            SELECT 
                COUNT(*) as total_parts,
                SUM(quantity_in_stock) as total_quantity,
                SUM(quantity_in_stock * unit_price) as total_value,
                SUM(CASE WHEN quantity_in_stock <= reorder_level THEN 1 ELSE 0 END) as low_stock_items
            FROM spare_parts
        `);
        connection.release();
        
        res.json(summary[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
