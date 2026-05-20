-- Smart Machine Maintenance System Database Schema
-- MySQL Database

CREATE DATABASE IF NOT EXISTS machine_maintenance_db;
USE machine_maintenance_db;

-- Users Table (Admin and Staff)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Machines Table
CREATE TABLE machines (
    machine_id INT PRIMARY KEY AUTO_INCREMENT,
    machine_code VARCHAR(50) UNIQUE NOT NULL,
    machine_name VARCHAR(100) NOT NULL,
    description TEXT,
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    purchase_date DATE,
    location VARCHAR(100),
    status ENUM('active', 'inactive', 'maintenance', 'breakdown') DEFAULT 'active',
    last_service_date DATE,
    next_service_date DATE,
    service_interval_days INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_next_service (next_service_date)
);

-- Service History Table
CREATE TABLE service_history (
    service_id INT PRIMARY KEY AUTO_INCREMENT,
    machine_id INT NOT NULL,
    service_date DATE NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    description TEXT,
    performed_by INT,
    parts_used TEXT,
    cost DECIMAL(10, 2),
    next_service_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(user_id),
    INDEX idx_machine (machine_id),
    INDEX idx_service_date (service_date)
);

-- Spare Parts Inventory Table
CREATE TABLE spare_parts (
    part_id INT PRIMARY KEY AUTO_INCREMENT,
    part_code VARCHAR(50) UNIQUE NOT NULL,
    part_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit_price DECIMAL(10, 2),
    quantity_in_stock INT DEFAULT 0,
    reorder_level INT DEFAULT 5,
    reorder_quantity INT DEFAULT 10,
    supplier VARCHAR(100),
    last_restocked_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_quantity (quantity_in_stock)
);

-- Parts Used in Services (Junction Table)
CREATE TABLE service_parts (
    service_part_id INT PRIMARY KEY AUTO_INCREMENT,
    service_id INT NOT NULL,
    part_id INT NOT NULL,
    quantity_used INT NOT NULL,
    FOREIGN KEY (service_id) REFERENCES service_history(service_id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES spare_parts(part_id),
    INDEX idx_service (service_id),
    INDEX idx_part (part_id)
);

-- Breakdown Reports Table
CREATE TABLE breakdown_reports (
    breakdown_id INT PRIMARY KEY AUTO_INCREMENT,
    machine_id INT NOT NULL,
    reported_by INT NOT NULL,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('reported', 'assigned', 'in_progress', 'resolved', 'closed') DEFAULT 'reported',
    assigned_to INT,
    resolution_notes TEXT,
    resolved_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by) REFERENCES users(user_id),
    FOREIGN KEY (assigned_to) REFERENCES users(user_id),
    INDEX idx_machine (machine_id),
    INDEX idx_status (status),
    INDEX idx_severity (severity)
);

-- Notifications Table
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('service_reminder', 'low_stock', 'breakdown_alert', 'maintenance_alert') NOT NULL,
    title VARCHAR(100),
    message TEXT NOT NULL,
    related_machine_id INT,
    related_part_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (related_machine_id) REFERENCES machines(machine_id),
    FOREIGN KEY (related_part_id) REFERENCES spare_parts(part_id),
    INDEX idx_user (user_id),
    INDEX idx_is_read (is_read)
);

-- Activity Log Table
CREATE TABLE activity_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_values JSON,
    new_values JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_user (user_id)
);

-- Dashboard Analytics Table (Cached data for performance)
CREATE TABLE analytics_cache (
    cache_id INT PRIMARY KEY AUTO_INCREMENT,
    metric_name VARCHAR(100) NOT NULL,
    metric_value JSON,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_metric_name (metric_name)
);

-- Create Indexes for common queries
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_machine_service_status ON machines(machine_id, status);
CREATE INDEX idx_parts_stock_alert ON spare_parts(quantity_in_stock, reorder_level);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES ('admin', 'admin@biofood.com', '$2a$10$du93eLI0KDkQIDzKEl5nn.NQImszDYDKelXmum5UVv1JR8HgObTVm', 'admin', 'Admin', 'User');
