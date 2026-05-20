const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../models/database');

// Login
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const connection = await pool.getConnection();
        const [users] = await connection.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        connection.release();
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { user_id: user.user_id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        res.json({ token, user: { user_id: user.user_id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Register (Admin only)
exports.register = async (req, res) => {
    try {
        const { username, email, password, role, first_name, last_name } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await pool.getConnection();
        
        await connection.query(
            'INSERT INTO users (username, email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, role || 'staff', first_name, last_name]
        );
        connection.release();
        
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [users] = await connection.query(
            'SELECT user_id, username, email, role, first_name, last_name FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        connection.release();
        
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
