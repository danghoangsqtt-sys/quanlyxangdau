const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// Initialize DB (creates file in the root directory)
const db = new Database('fleet.db');

// --- UTILS ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// --- INITIALIZATION ---
function initDB() {
    // 1. Users Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT,
      role TEXT DEFAULT 'user'
    )
  `);

    // Seed Admin if empty
    const userCount = db.prepare('SELECT count(*) as count FROM users').get();
    if (userCount.count === 0) {
        const insert = db.prepare('INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)');
        insert.run('admin', hashPassword('123456'), 'System Administrator', 'admin');
        console.log("Database initialized. Default Admin: admin / 123456");
    }

    // 2. Vehicles Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_number TEXT UNIQUE NOT NULL,
      model TEXT,
      fuel_type TEXT,
      current_km INTEGER DEFAULT 0
    )
  `);

    // Seed Dummy Vehicles if empty
    const vCount = db.prepare('SELECT count(*) as count FROM vehicles').get();
    if (vCount.count === 0) {
        const insertV = db.prepare('INSERT INTO vehicles (plate_number, model, fuel_type, current_km) VALUES (?, ?, ?, ?)');
        insertV.run('29A-123.45', 'Toyota Fortuner', 'Diesel', 15000);
        insertV.run('30E-999.99', 'Ford Ranger', 'Diesel', 5000);
        insertV.run('51F-888.88', 'VinFast Lux A', 'Petrol', 8000);
    }

    // 3. Drivers Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      license_id TEXT,
      department TEXT
    )
  `);

    // Seed Dummy Drivers if empty
    const dCount = db.prepare('SELECT count(*) as count FROM drivers').get();
    if (dCount.count === 0) {
        const insertD = db.prepare('INSERT INTO drivers (name, license_id, department) VALUES (?, ?, ?)');
        insertD.run('Nguyen Van A', 'B2-123456', 'Logistics');
        insertD.run('Tran Van B', 'C-987654', 'Transport');
    }

    // 4. Fuel Logs Table
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_time TEXT NOT NULL,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      odometer INTEGER NOT NULL,
      liters REAL NOT NULL,
      price REAL NOT NULL,
      total_cost REAL NOT NULL,
      created_by TEXT,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY(driver_id) REFERENCES drivers(id)
    )
  `);
}

// --- EXPORTS API ---

// Auth
exports.login = (username, password) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    if (user && user.password === hashPassword(password)) {
        return { id: user.id, username: user.username, fullname: user.fullname, role: user.role };
    }
    return null;
};

exports.changePassword = (id, newPassword) => {
    const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    return stmt.run(hashPassword(newPassword), id);
};

exports.createUser = (username, password, fullname, role) => {
    try {
        const stmt = db.prepare('INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)');
        return stmt.run(username, hashPassword(password), fullname, role);
    } catch (err) {
        throw err;
    }
};

// Data Getters
exports.getVehicles = () => db.prepare('SELECT * FROM vehicles ORDER BY plate_number').all();
exports.getDrivers = () => db.prepare('SELECT * FROM drivers ORDER BY name').all();

exports.getDashboardStats = () => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const totalLiters = db.prepare('SELECT SUM(liters) as total FROM fuel_logs WHERE date_time LIKE ?').get(`${currentMonth}%`).total || 0;
    const totalCost = db.prepare('SELECT SUM(total_cost) as total FROM fuel_logs WHERE date_time LIKE ?').get(`${currentMonth}%`).total || 0;

    // Vehicle with most usage this month
    const topVehicle = db.prepare(`
    SELECT v.plate_number, SUM(f.liters) as total_liters 
    FROM fuel_logs f
    JOIN vehicles v ON f.vehicle_id = v.id
    WHERE f.date_time LIKE ?
    GROUP BY f.vehicle_id 
    ORDER BY total_liters DESC LIMIT 1
  `).get(`${currentMonth}%`);

    return {
        totalLiters: totalLiters.toFixed(2),
        totalCost: totalCost.toFixed(0),
        topVehicle: topVehicle ? `${topVehicle.plate_number} (${topVehicle.total_liters.toFixed(1)}L)` : 'N/A'
    };
};

exports.getRecentLogs = (limit = 10) => {
    return db.prepare(`
    SELECT f.id, f.date_time, v.plate_number, d.name as driver_name, f.odometer, f.liters, f.total_cost, f.created_by
    FROM fuel_logs f
    JOIN vehicles v ON f.vehicle_id = v.id
    JOIN drivers d ON f.driver_id = d.id
    ORDER BY f.date_time DESC
    LIMIT ?
  `).all(limit);
};

exports.getAllLogsForExport = () => {
    return db.prepare(`
    SELECT f.id, f.date_time, v.plate_number, v.model, d.name as driver_name, f.odometer, f.liters, f.price, f.total_cost, f.created_by
    FROM fuel_logs f
    JOIN vehicles v ON f.vehicle_id = v.id
    JOIN drivers d ON f.driver_id = d.id
    ORDER BY f.date_time DESC
  `).all();
};

// Actions
exports.addFuelLog = (data) => {
    // data: { vehicle_id, driver_id, date_time, odometer, liters, price, created_by }
    const total_cost = data.liters * data.price;

    const insert = db.prepare(`
    INSERT INTO fuel_logs (vehicle_id, driver_id, date_time, odometer, liters, price, total_cost, created_by)
    VALUES (@vehicle_id, @driver_id, @date_time, @odometer, @liters, @price, @total_cost, @created_by)
  `);

    const updateVehicle = db.prepare(`
    UPDATE vehicles SET current_km = ? WHERE id = ? AND current_km < ?
  `);

    const transaction = db.transaction(() => {
        insert.run({ ...data, total_cost });
        // Update vehicle ODO only if new ODO is greater
        updateVehicle.run(data.odometer, data.vehicle_id, data.odometer);
    });

    return transaction();
};

// Initialize on load
initDB();
