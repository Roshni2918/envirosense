-- Nagaon River Water Quality Monitoring System Database Schema

-- Create Database
CREATE DATABASE IF NOT EXISTS nagaon_river_monitoring;
USE nagaon_river_monitoring;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'USER') DEFAULT 'USER',
    village_name VARCHAR(100),
    language_preference ENUM('en', 'mr') DEFAULT 'mr',
    status ENUM('ACTIVE', 'BLOCKED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sensor Data Table
CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ph DECIMAL(4, 2) NOT NULL,
    tds INT NOT NULL,
    turbidity DECIMAL(5, 2) NOT NULL,
    dissolved_oxygen DECIMAL(4, 2) NOT NULL,
    temperature DECIMAL(4, 2) NOT NULL,
    water_level DECIMAL(5, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp)
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parameter_name VARCHAR(50) NOT NULL,
    message_en TEXT NOT NULL,
    message_mr TEXT NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    current_value DECIMAL(10, 2) NOT NULL,
    safe_min DECIMAL(10, 2) NOT NULL,
    safe_max DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    INDEX idx_timestamp (timestamp),
    INDEX idx_severity (severity)
);

-- Settings Table (for safe threshold values)
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parameter_name VARCHAR(50) UNIQUE NOT NULL,
    min_value DECIMAL(10, 2) NOT NULL,
    max_value DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert Default Settings
INSERT INTO settings (parameter_name, min_value, max_value, unit) VALUES
('pH', 6.5, 8.5, 'pH'),
('TDS', 50, 300, 'ppm'),
('Turbidity', 0, 5, 'NTU'),
('Dissolved Oxygen', 5, 8, 'mg/L'),
('Temperature', 20, 30, '°C'),
('Water Level', 40, 100, '%');

-- Insert Default Admin User (password: admin123 - will be hashed by backend)
INSERT INTO users (name, email, phone, password, role, village_name, language_preference, status) VALUES
('Admin', 'admin@nagaon.com', '0000000000', '$2b$10$placeholder_hash', 'ADMIN', 'Nagaon', 'en', 'ACTIVE');

-- Create Indexes for better performance
CREATE INDEX idx_sensor_data_timestamp ON sensor_data(timestamp DESC);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
