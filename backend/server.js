const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const db = require('./db');

const webPush = require('web-push');

require('dotenv').config();

// ================= VAPID KEYS FOR WEB PUSH =================
const vapidKeys = (() => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const generated = webPush.generateVAPIDKeys();
  console.log('Generated new VAPID keys (save to .env for persistence):');
  console.log(`VAPID_PUBLIC_KEY=${generated.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${generated.privateKey}`);
  return generated;
})();

webPush.setVapidDetails(
  'mailto:admin@envirosense.local',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory push subscription store
const pushSubscriptions = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'nagaon_river_secret_key_2024';

app.use(cors());
app.use(express.json());

// ================= AUTH MIDDLEWARE =================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token.' });
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied. Admin only.' });
  next();
};

// ================= SYSTEM LOGGING =================
const logAction = (userRole, userRefId, action) => {
  db.query('INSERT INTO system_logs (user_role, user_ref_id, action_text) VALUES (?, ?, ?)',
    [userRole, userRefId, action], (err) => { if (err) console.error('Log error:', err); });
};

// ================= PROFESSIONAL SENSOR SIMULATION =================
const sensorState = {
  ph: 7.2, tds: 180, turbidity: 2.1, dissolved_oxygen: 6.8, temperature: 26.0, water_level: 62.0
};

const getSeasonalFactor = () => {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) return 'summer';
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 10 && month <= 11) return 'post-monsoon';
  return 'winter';
};

const generateSensorData = () => {
  const hour = new Date().getHours();
  const season = getSeasonalFactor();
  const tempPattern = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 3;
  const seasonalTempOffset = season === 'summer' ? 4 : season === 'monsoon' ? -1 : season === 'winter' ? -3 : 0;
  const seasonalTurbidityBase = season === 'monsoon' ? 1.5 : 0;
  const seasonalWaterLevel = season === 'monsoon' ? 10 : season === 'summer' ? -8 : 0;

  const drift = (base, range, variability = 0.15) => {
    const change = (Math.random() - 0.5) * variability;
    let val = base + change;
    const center = range[0] + (range[1] - range[0]) / 2;
    if (Math.abs(val - center) > (range[1] - range[0]) * 0.35) val += (center - val) * 0.05;
    return Math.max(range[0], Math.min(range[1], val));
  };

  sensorState.ph = drift(sensorState.ph, [6.8, 8.0], 0.06);
  sensorState.tds = drift(sensorState.tds, [60, 260], 3);
  sensorState.turbidity = drift(sensorState.turbidity + seasonalTurbidityBase * 0.01, [0.5, 5.5], 0.1);
  sensorState.dissolved_oxygen = drift(sensorState.dissolved_oxygen, [5.2, 7.8], 0.1);
  sensorState.temperature = drift(sensorState.temperature + (tempPattern + seasonalTempOffset) * 0.02, [18, 35], 0.1);
  sensorState.water_level = drift(sensorState.water_level + seasonalWaterLevel * 0.01, [35, 92], 0.6);

  return {
    ph: Math.round(sensorState.ph * 100) / 100,
    tds: Math.round(sensorState.tds),
    turbidity: Math.round(sensorState.turbidity * 100) / 100,
    dissolved_oxygen: Math.round(sensorState.dissolved_oxygen * 100) / 100,
    temperature: Math.round(sensorState.temperature * 100) / 100,
    water_level: Math.round(sensorState.water_level * 100) / 100
  };
};

// ================= ALERT SYSTEM =================
const checkAndCreateAlert = (sensorData, sourceId = 1) => {
  const queries = [
    { param: 'pH', value: sensorData.ph, field: 'ph' },
    { param: 'TDS', value: sensorData.tds, field: 'tds' },
    { param: 'Turbidity', value: sensorData.turbidity, field: 'turbidity' },
    { param: 'Dissolved Oxygen', value: sensorData.dissolved_oxygen, field: 'dissolved_oxygen' },
    { param: 'Temperature', value: sensorData.temperature, field: 'temperature' },
    { param: 'Water Level', value: sensorData.water_level, field: 'water_level' }
  ];

  let alertCount = 0;
  let completed = 0;

  queries.forEach(query => {
    db.query('SELECT min_value, max_value FROM settings WHERE parameter_name = ?', [query.param], (err, results) => {
      if (err || results.length === 0) { completed++; return; }
      const { min_value, max_value } = results[0];

      if (query.value < min_value || query.value > max_value) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        db.query(
          `SELECT * FROM alerts WHERE parameter_name = ? AND generated_at > ? AND alert_status = 'Active' ORDER BY generated_at DESC LIMIT 1`,
          [query.param, oneHourAgo], (err, recentAlerts) => {
            if (err || recentAlerts.length > 0) { completed++; return; }

            const severity = query.value < min_value * 0.4 || query.value > max_value * 1.6 ? 'CRITICAL' :
              query.value < min_value * 0.6 || query.value > max_value * 1.3 ? 'HIGH' : 'MEDIUM';

            const icon = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : '⚡';
            const messageEn = `${icon} Water Quality Alert! ${query.param} is ${query.value}. Safe range: ${min_value}-${max_value}. Water is unsafe for usage.`;
            const messageMr = `${icon} पाणी गुणवत्ता सूचना! ${query.param} ${query.value} आहे. सुरक्षित श्रेणी: ${min_value}-${max_value}. पाणी वापरण्यास सुरक्षित नाही.`;

            db.query(
              `INSERT INTO alerts (parameter_name, alert_message_en, alert_message_mr, measured_value, threshold_value, alert_status) VALUES (?, ?, ?, ?, ?, 'Active')`,
              [query.param, messageEn, messageMr, query.value, max_value], (err) => {
                if (!err) {
                  alertCount++;
                  console.log(`Alert created for ${query.param}: ${query.value}`);
                   db.query('SELECT * FROM alerts ORDER BY generated_at DESC LIMIT 1', (err, newAlert) => {
                    if (!err && newAlert.length > 0) {
                      io.emit('new-alert', newAlert[0]);
                      io.emit('notification', {
                        type: severity === 'CRITICAL' ? 'danger' : 'warning',
                        title: `Alert: ${query.param}`,
                        message: messageEn,
                        icon
                      });
                      sendPushNotification(
                        `🚨 Water Quality Alert: ${query.param}`,
                        messageEn
                      );
                    }
                  });
                }
                completed++;
              });
          });
      } else {
        completed++;
      }
    });
  });
};

// ================= SOCKET.IO =================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ================= CRON JOB =================
cron.schedule('*/10 * * * *', () => {
  console.log('Generating sensor data...');
  const sensorData = generateSensorData();
  db.query(
    `INSERT INTO sensor_readings (sensor_id, reading_value, reading_time, ph, tds, turbidity, dissolved_oxygen, temperature, water_level) VALUES (1, 0, NOW(), ?, ?, ?, ?, ?, ?)`,
    [sensorData.ph, sensorData.tds, sensorData.turbidity, sensorData.dissolved_oxygen, sensorData.temperature, sensorData.water_level],
    (err, result) => {
      if (err) { console.error('Error inserting sensor data:', err); return; }
      console.log('Sensor data inserted:', sensorData);
      checkAndCreateAlert(sensorData);
      db.query('SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1', (err, latest) => {
        if (!err && latest.length > 0) {
          io.emit('sensor-update', latest[0]);
        }
      });
    }
  );
});

// ================= TEST ROUTE =================
app.get('/api/test', (req, res) => {
  res.json({ message: "EnviroSense API is Running", version: "2.0.0", status: "healthy" });
});

// ================= SOCKET.IO HEALTH =================
app.get('/api/health', (req, res) => {
  const clientCount = io.engine.clientsCount;
  res.json({ status: 'healthy', uptime: process.uptime(), connectedClients: clientCount, timestamp: new Date().toISOString() });
});

// ================= AUTH ROUTES =================
app.post('/api/register', async (req, res) => {
  const { name, email, phone, password, village_name, language_preference } = req.body;
  if (!name || !email || !phone || !password || !village_name)
    return res.status(400).json({ message: "All fields are required ❌" });
  try {
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
      if (err) return res.status(500).json({ message: "Database Error ❌" });
      if (result.length > 0) return res.status(400).json({ message: "User already exists ❌" });
      const hashedPassword = await bcrypt.hash(password, 10);
      const sql = `INSERT INTO users (user_name, email, mobile_no, password_hash, village_name, language_preference, role) VALUES (?, ?, ?, ?, ?, ?, 'USER')`;
      db.query(sql, [name, email, phone, hashedPassword, village_name, language_preference || 'mr'], (err) => {
        if (err) return res.status(500).json({ message: "Registration Failed ❌" });
        logAction('User', 0, `New registration: ${email}`);
        res.json({ message: "Registered Successfully ✅" });
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Error ❌" });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "All fields required ❌" });
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    if (results.length === 0) return res.status(404).json({ message: "User not found ❌" });
    const user = results[0];
    if (user.status === 'BLOCKED') return res.status(403).json({ message: "Account is blocked. Contact admin." });
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Wrong Password ❌" });
    const token = jwt.sign({ id: user.user_id, email: user.email, role: user.role, name: user.user_name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Login Successful ✅", token,
      user: { id: user.user_id, name: user.user_name, email: user.email, role: user.role, village_name: user.village_name, language_preference: user.language_preference, mobile_no: user.mobile_no }
    });
  });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@nagaon.com' && password === 'admin123') {
    const token = jwt.sign({ id: 1, email, role: 'ADMIN', name: 'Admin' }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ message: "Admin Login Successful ✅", token, user: { id: 1, name: 'Admin', email, role: 'ADMIN' } });
  }
  db.query("SELECT * FROM users WHERE email = ? AND role = 'ADMIN'", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    if (results.length === 0) return res.status(404).json({ message: "Admin not found ❌" });
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Wrong Password ❌" });
    const token = jwt.sign({ id: user.user_id, email: user.email, role: user.role, name: user.user_name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Admin Login Successful ✅", token, user: { id: user.user_id, name: user.user_name, email: user.email, role: user.role } });
  });
});

// ================= PROFILE ROUTES =================
app.get('/api/profile', authenticateToken, (req, res) => {
  db.query("SELECT user_id, user_name, email, mobile_no, village_name, language_preference, role, status, created_at FROM users WHERE user_id = ?", [req.user.id], (err, result) => {
    if (err || result.length === 0) return res.status(404).json({ message: "User not found" });
    res.json({ data: result[0] });
  });
});

app.put('/api/profile', authenticateToken, (req, res) => {
  const { name, phone, village_name, language_preference } = req.body;
  db.query("UPDATE users SET user_name = COALESCE(?, user_name), mobile_no = COALESCE(?, mobile_no), village_name = COALESCE(?, village_name), language_preference = COALESCE(?, language_preference) WHERE user_id = ?",
    [name, phone, village_name, language_preference, req.user.id], (err) => {
      if (err) return res.status(500).json({ message: "Update failed ❌" });
      logAction('User', req.user.id, 'Profile updated');
      res.json({ message: "Profile updated successfully ✅" });
    });
});

app.put('/api/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both passwords required ❌" });
  try {
    db.query("SELECT password_hash FROM users WHERE user_id = ?", [req.user.id], async (err, result) => {
      if (err || result.length === 0) return res.status(404).json({ message: "User not found" });
      const isMatch = await bcrypt.compare(currentPassword, result[0].password_hash);
      if (!isMatch) return res.status(401).json({ message: "Current password is wrong ❌" });
      const hashed = await bcrypt.hash(newPassword, 10);
      db.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [hashed, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: "Password change failed ❌" });
        logAction('User', req.user.id, 'Password changed');
        res.json({ message: "Password changed successfully ✅" });
      });
    });
  } catch (e) { res.status(500).json({ message: "Error ❌" }); }
});

// ================= SENSOR DATA ROUTES =================
app.get('/api/sensor-data/latest', (req, res) => {
  db.query("SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result[0] });
  });
});

app.get('/api/sensor-data', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  db.query("SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT ? OFFSET ?", [parseInt(limit), parseInt(offset)], (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.get('/api/sensor-data/charts', (req, res) => {
  db.query("SELECT * FROM sensor_readings WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY recorded_at ASC", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.post('/api/sensor-data', (req, res) => {
  const { ph, tds, turbidity, dissolved_oxygen, temperature, water_level } = req.body;
  db.query("INSERT INTO sensor_readings (sensor_id, reading_value, reading_time, ph, tds, turbidity, dissolved_oxygen, temperature, water_level) VALUES (1, 0, NOW(), ?, ?, ?, ?, ?, ?)",
    [ph, tds, turbidity, dissolved_oxygen, temperature, water_level], (err, result) => {
      if (err) return res.status(500).json({ message: "Database Error ❌" });
      const sensorData = { ph, tds, turbidity, dissolved_oxygen, temperature, water_level };
      checkAndCreateAlert(sensorData);
      db.query('SELECT * FROM sensor_readings WHERE reading_id = ?', [result.insertId], (err, newReading) => {
        if (!err && newReading.length > 0) io.emit('sensor-update', newReading[0]);
      });
      res.json({ message: "Sensor data inserted successfully ✅" });
    });
});

// ================= CALENDAR DATA =================
app.get('/api/calendar-data', (req, res) => {
  const { year, month } = req.query;
  const startDate = `${year || 2026}-${String(month || 5).padStart(2, '0')}-01`;
  db.query(
    `SELECT DATE(recorded_at) as date, COUNT(*) as readings,
     ROUND(AVG(ph),2) as avg_ph, ROUND(AVG(tds),0) as avg_tds,
     ROUND(AVG(turbidity),2) as avg_turbidity, ROUND(AVG(dissolved_oxygen),2) as avg_do,
     ROUND(AVG(temperature),1) as avg_temp, ROUND(AVG(water_level),1) as avg_water_level
     FROM sensor_readings WHERE recorded_at >= ? AND recorded_at < DATE_ADD(?, INTERVAL 1 MONTH)
     GROUP BY DATE(recorded_at) ORDER BY date`,
    [startDate, startDate], (err, result) => {
      if (err) return res.status(500).json({ message: "Database Error ❌" });
      res.json({ data: result });
    });
});

// ================= SYSTEM HEALTH =================
app.get('/api/system-health', (req, res) => {
  const queries = [
    db.promise().query("SELECT COUNT(*) as total FROM sensor_readings WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)").then(r => ({ lastHourReadings: r[0][0].total })),
    db.promise().query("SELECT recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1").then(r => ({ lastReading: r[0][0]?.recorded_at })),
    db.promise().query("SELECT COUNT(*) as total FROM alerts WHERE alert_status = 'Active'").then(r => ({ activeAlerts: r[0][0].total })),
    db.promise().query("SELECT COUNT(*) as total FROM sensors WHERE sensor_status = 'Active'").then(r => ({ activeSensors: r[0][0].total })),
    db.promise().query("SELECT COUNT(*) as total FROM users WHERE status = 'ACTIVE'").then(r => ({ activeUsers: r[0][0].total })),
    db.promise().query("SELECT COUNT(*) as total FROM sensor_readings").then(r => ({ totalReadings: r[0][0].total }))
  ];
  Promise.all(queries).then(results => {
    const health = Object.assign({}, ...results);
    const minutesSinceLastReading = health.lastReading ? Math.floor((Date.now() - new Date(health.lastReading).getTime()) / 60000) : -1;
    health.status = minutesSinceLastReading < 20 ? 'healthy' : minutesSinceLastReading < 60 ? 'degraded' : 'down';
    health.minutesSinceLastReading = minutesSinceLastReading;
    res.json({ data: health });
  }).catch(() => res.status(500).json({ message: "Health check failed" }));
});

// ================= VILLAGE COMPARISON =================
app.get('/api/village-comparison', (req, res) => {
  const sql = `SELECT ws.village_name, ws.source_name, ws.source_type,
    ROUND(AVG(sr.ph),2) as avg_ph, ROUND(AVG(sr.tds),0) as avg_tds,
    ROUND(AVG(sr.turbidity),2) as avg_turbidity, ROUND(AVG(sr.dissolved_oxygen),2) as avg_do,
    ROUND(AVG(sr.temperature),1) as avg_temp, ROUND(AVG(sr.water_level),1) as avg_water_level,
    COUNT(sr.reading_id) as reading_count
    FROM water_sources ws LEFT JOIN sensor_readings sr ON sr.sensor_id = ws.source_id
    GROUP BY ws.source_id ORDER BY ws.village_name`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

// ================= STATS =================
app.get('/api/stats', (req, res) => {
  Promise.all([
    db.promise().query("SELECT COUNT(*) as c FROM sensor_readings"),
    db.promise().query("SELECT COUNT(*) as c FROM users WHERE role='USER'"),
    db.promise().query("SELECT COUNT(*) as c FROM alerts WHERE alert_status='Active'"),
    db.promise().query("SELECT COUNT(*) as c FROM queries WHERE status='Pending'"),
    db.promise().query("SELECT COUNT(*) as c FROM water_sources WHERE source_status='Active'"),
    db.promise().query("SELECT COUNT(*) as c FROM sensor_readings WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)")
  ]).then(([readings, users, alerts, queries, sources, todayReadings]) => {
    res.json({
      data: {
        totalReadings: readings[0][0].c,
        totalUsers: users[0][0].c,
        activeAlerts: alerts[0][0].c,
        pendingQueries: queries[0][0].c,
        activeSources: sources[0][0].c,
        todayReadings: todayReadings[0][0].c
      }
    });
  }).catch(() => res.status(500).json({ message: "Stats fetch failed" }));
});

// ================= CSV EXPORT =================
app.get('/api/csv-export', authenticateToken, (req, res) => {
  const { start_date, end_date } = req.query;
  let sql = "SELECT * FROM sensor_readings";
  let params = [];
  if (start_date && end_date) { sql += " WHERE recorded_at BETWEEN ? AND ?"; params = [start_date, end_date]; }
  sql += " ORDER BY recorded_at DESC";
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    const headers = 'Date & Time,pH,TDS,Turbidity,Dissolved Oxygen,Temperature,Water Level,Status\n';
    const rows = result.map(r => {
      const status = 'Unknown';
      return `"${new Date(r.recorded_at).toLocaleString()}",${r.ph},${r.tds},${r.turbidity},${r.dissolved_oxygen},${r.temperature},${r.water_level},"${status}"`;
    }).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=water-quality-export.csv`);
    res.send('\ufeff' + headers + rows);
  });
});

// ================= ALERT ROUTES =================
app.get('/api/alerts', authenticateToken, (req, res) => {
  const { limit = 20 } = req.query;
  db.query("SELECT * FROM alerts ORDER BY generated_at DESC LIMIT ?", [parseInt(limit)], (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.get('/api/alerts/unresolved', authenticateToken, (req, res) => {
  db.query("SELECT * FROM alerts WHERE alert_status = 'Active' ORDER BY generated_at DESC", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.put('/api/alerts/:id/resolve', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("UPDATE alerts SET alert_status = 'Resolved' WHERE alert_id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ message: "Alert resolved successfully ✅" });
  });
});

// ================= USER MANAGEMENT ROUTES (ADMIN) =================
app.get('/api/users', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("SELECT user_id AS id, user_name AS name, email, mobile_no AS phone, village_name, language_preference, role, status, created_at FROM users ORDER BY created_at DESC", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.put('/api/users/:id/block', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("UPDATE users SET status = 'BLOCKED' WHERE user_id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    logAction('Admin', req.user.id, `Blocked user ${req.params.id}`);
    res.json({ message: "User blocked successfully ✅" });
  });
});

app.put('/api/users/:id/unblock', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("UPDATE users SET status = 'ACTIVE' WHERE user_id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    logAction('Admin', req.user.id, `Unblocked user ${req.params.id}`);
    res.json({ message: "User unblocked successfully ✅" });
  });
});

app.delete('/api/users/:id', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("DELETE FROM users WHERE user_id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    logAction('Admin', req.user.id, `Deleted user ${req.params.id}`);
    res.json({ message: "User deleted successfully ✅" });
  });
});

// ================= SETTINGS ROUTES =================
app.get('/api/settings', (req, res) => {
  db.query("SELECT * FROM settings", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.put('/api/settings/:id', authenticateToken, authenticateAdmin, (req, res) => {
  const { min_value, max_value } = req.body;
  db.query("UPDATE settings SET min_value = ?, max_value = ? WHERE id = ?", [min_value, max_value, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    logAction('Admin', req.user.id, `Updated setting ${req.params.id}`);
    res.json({ message: "Setting updated successfully ✅" });
  });
});

// ================= REPORT ROUTES =================
app.get('/api/report/data', authenticateToken, authenticateAdmin, (req, res) => {
  const { start_date, end_date } = req.query;
  let sql = "SELECT * FROM sensor_readings";
  let params = [];
  if (start_date && end_date) { sql += " WHERE recorded_at BETWEEN ? AND ?"; params = [start_date, end_date]; }
  sql += " ORDER BY recorded_at DESC";
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

// ================= QUERIES ROUTES =================
app.post('/api/queries', authenticateToken, (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ message: "Subject and message required ❌" });
  db.query("INSERT INTO queries (user_id, user_name, user_email, subject, message) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, req.user.name, req.user.email, subject, message], (err) => {
      if (err) return res.status(500).json({ message: "Database Error ❌" });
      logAction('User', req.user.id, `Submitted query: ${subject}`);
      res.json({ message: "Query submitted successfully ✅" });
    });
});

app.get('/api/queries', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("SELECT * FROM queries ORDER BY created_at DESC", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

app.put('/api/queries/:id/resolve', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("UPDATE queries SET status = 'Resolved' WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ message: "Query resolved ✅" });
  });
});

// ================= USER DATA ROUTE =================
app.get('/api/user/data', authenticateToken, (req, res) => {
  const { start_date, end_date } = req.query;
  let sql = "SELECT * FROM sensor_readings";
  let params = [];
  if (start_date && end_date) { sql += " WHERE recorded_at BETWEEN ? AND ?"; params = [start_date, end_date]; }
  sql += " ORDER BY recorded_at DESC";
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

// ================= WATER SOURCES =================
app.get('/api/water-sources', (req, res) => {
  db.query("SELECT * FROM water_sources WHERE source_status = 'Active'", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

// ================= SYSTEM LOGS =================
app.get('/api/logs', authenticateToken, authenticateAdmin, (req, res) => {
  db.query("SELECT * FROM system_logs ORDER BY action_time DESC LIMIT 100", (err, result) => {
    if (err) return res.status(500).json({ message: "Database Error ❌" });
    res.json({ data: result });
  });
});

// ================= NOTIFICATIONS =================
app.get('/api/notifications', authenticateToken, (req, res) => {
  Promise.all([
    db.promise().query("SELECT COUNT(*) as c FROM alerts WHERE alert_status='Active'"),
    db.promise().query("SELECT COUNT(*) as c FROM queries WHERE user_id=? AND status='Pending'", [req.user.id])
  ]).then(([alerts, queries]) => {
    const notifications = [];
    if (alerts[0][0].c > 0) notifications.push({ type: 'danger', count: alerts[0][0].c, message: `${alerts[0][0].c} active water quality alerts` });
    if (queries[0][0].c > 0) notifications.push({ type: 'info', count: queries[0][0].c, message: `${queries[0][0].c} pending queries` });
    res.json({ data: notifications });
  }).catch(() => res.status(500).json({ message: "Failed" }));
});

// ================= PUSH NOTIFICATIONS =================
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', (req, res) => {
  const { subscription, userId } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ message: 'Invalid subscription' });
  }
  const key = subscription.endpoint;
  pushSubscriptions.set(key, { subscription, userId: userId || 'anonymous', createdAt: new Date() });
  console.log(`Push subscription stored for user ${userId || 'anonymous'} (${pushSubscriptions.size} total)`);
  res.json({ message: 'Subscribed successfully' });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ message: 'Endpoint required' });
  pushSubscriptions.delete(endpoint);
  console.log(`Push subscription removed (${pushSubscriptions.size} remaining)`);
  res.json({ message: 'Unsubscribed successfully' });
});

const sendPushNotification = (title, body, icon = 'https://cdn-icons-png.flaticon.com/512/4711/4711987.png', url = null) => {
  const payload = JSON.stringify({ title, body, icon, badge: icon, data: { url } });
  const promises = [];
  for (const [key, entry] of pushSubscriptions) {
    promises.push(
      webPush.sendNotification(entry.subscription, payload)
        .catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Removing stale subscription: ${key}`);
            pushSubscriptions.delete(key);
          } else {
            console.error('Push send error:', err.message);
          }
        })
    );
  }
  return Promise.allSettled(promises);
};

// ================= SERVER SUMMARY FOR LANDING =================
app.get('/api/summary', (req, res) => {
  Promise.all([
    db.promise().query("SELECT COUNT(*) as c FROM sensor_readings"),
    db.promise().query("SELECT COUNT(*) as c FROM users WHERE role='USER'"),
    db.promise().query("SELECT COUNT(*) as c FROM alerts WHERE alert_status='Active'"),
    db.promise().query("SELECT COUNT(*) as c FROM water_sources"),
    db.promise().query("SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 12")
  ]).then(([totalR, totalU, activeAlerts, sources, recent]) => {
    res.json({
      data: {
        totalReadings: recent[0][0]?.c || totalR[0][0].c,
        totalUsers: totalU[0][0].c,
        activeAlerts: activeAlerts[0][0].c,
        totalSources: sources[0][0].c,
        recentReadings: recent[0]
      }
    });
  }).catch(() => res.json({ data: { totalReadings: 0, totalUsers: 0, activeAlerts: 0, totalSources: 0, recentReadings: [] } }));
});

// ================= START SERVER =================
server.listen(PORT, () => {
  console.log(`EnviroSense v2.0 Backend running on port ${PORT} 🚀`);
  console.log(`Sensor simulation active (every 10 mins)`);
  console.log(`WebSocket ready for real-time updates`);
});
