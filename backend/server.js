const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const db = require('./db');
const { generateSensorData, seedState } = require('./services/sensorSimulator');

const webPush = require('web-push');
const emailAlerts = require('./services/emailAlerts');
const smsAlerts = require('./services/smsAlerts');
const { buildRecommendations, buildSmsText } = require('./services/recommendations');

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
  db.insertDoc('system_logs', {
    user_role: userRole, user_ref_id: userRefId, action_text: action, action_time: new Date()
  }).catch((err) => console.error('Log error:', err.message));
};

// ================= OPTIONAL ADD-ON MODULES =================
require('./routes/exports')(app, { db, authenticateToken });
require('./routes/communityReports')(app, { db, io, logAction, authenticateToken, authenticateAdmin });
require('./routes/alertSubscribers')(app, { db, authenticateToken, authenticateAdmin, logAction, emailAlerts });
emailAlerts.register(app);

// ================= MONITORED PARAMETERS =================
// Only pH, TDS and Turbidity are monitored — everything else was removed.
const MONITORED_PARAMETERS = ['pH', 'TDS', 'Turbidity'];

const valueOf = (parameter, sensorData) =>
  parameter === 'pH' ? sensorData.ph : parameter === 'TDS' ? sensorData.tds : sensorData.turbidity;

// ================= PROFESSIONAL SENSOR SIMULATION =================
// A new reading is generated every hour with only a slight change
// from the previous one (see services/sensorSimulator.js).
const SENSOR_CRON = process.env.SENSOR_CRON || '0 * * * *';

// ================= ALERT SYSTEM =================
const checkAndCreateAlert = async (sensorData) => {
  try {
    const settings = await db.collection('settings')
      .find({ parameter_name: { $in: MONITORED_PARAMETERS } })
      .toArray();

    for (const setting of settings) {
      const value = valueOf(setting.parameter_name, sensorData);
      if (value === undefined || value === null) continue;
      const minValue = Number(setting.min_value);
      const maxValue = Number(setting.max_value);
      if (value >= minValue && value <= maxValue) continue;

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await db.collection('alerts').findOne(
        { parameter_name: setting.parameter_name, generated_at: { $gt: oneHourAgo }, alert_status: 'Active' },
        { sort: { generated_at: -1 } }
      );
      if (recent) continue;

      const severity = value < minValue * 0.4 || value > maxValue * 1.6 ? 'CRITICAL' :
        value < minValue * 0.6 || value > maxValue * 1.3 ? 'HIGH' : 'MEDIUM';

      const icon = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : '⚡';
      const messageEn = `${icon} Water Quality Alert! ${setting.parameter_name} is ${value}. Safe range: ${minValue}-${maxValue}. Water is unsafe for usage.`;
      const messageMr = `${icon} पाणी गुणवत्ता सूचना! ${setting.parameter_name} ${value} आहे. सुरक्षित श्रेणी: ${minValue}-${maxValue}. पाणी वापरण्यास सुरक्षित नाही.`;

      const alertDoc = await db.insertDoc('alerts', {
        parameter_name: setting.parameter_name,
        alert_message_en: messageEn,
        alert_message_mr: messageMr,
        measured_value: value,
        threshold_value: maxValue,
        alert_status: 'Active',
        severity,
        generated_at: new Date()
      });

      const alert = db.present(alertDoc, 'alert_id');
      console.log(`Alert created for ${setting.parameter_name}: ${value}`);
      io.emit('new-alert', alert);
      io.emit('notification', {
        type: severity === 'CRITICAL' ? 'danger' : 'warning',
        title: `Alert: ${setting.parameter_name}`,
        message: messageEn,
        icon
      });
      sendPushNotification(`🚨 Water Quality Alert: ${setting.parameter_name}`, messageEn);
      if (severity === 'CRITICAL') {
        // Real system — NO separate registration needed: every registered
        // user is notified automatically. Email carries the bilingual
        // "what to do" recommendations; SMS goes to every mobile number
        // on file (app users + landing-page subscribers), plus any static
        // ALERT_EMAIL_TO addresses.
        const recommendations = buildRecommendations(setting.parameter_name, value, minValue, maxValue);
        const [users, subscribers] = await Promise.all([
          db.collection('users').find({ status: 'ACTIVE' }).toArray(),
          db.collection('alert_subscribers').find({ active: true }).toArray()
        ]);
        const recipients = [
          ...new Set([
            ...emailAlerts.envRecipients(),
            ...users.map((u) => u.email),
            ...subscribers.map((s) => s.email)
          ].filter(Boolean))
        ];
        emailAlerts.sendCriticalAlert({
          parameter: setting.parameter_name,
          value,
          min: minValue,
          max: maxValue,
          message: messageEn,
          recommendations,
          recipients
        });
        const smsBody = buildSmsText(setting.parameter_name, value, minValue, maxValue, recommendations);
        const mobiles = [
          ...new Set([
            ...users.map((u) => u.mobile_no),
            ...subscribers.map((s) => s.mobile)
          ].filter(Boolean))
        ];
        for (const mobile of mobiles) {
          smsAlerts.sendSms({ to: mobile, body: smsBody }).catch(() => {});
        }
        console.log(`Critical alert dispatched to ${recipients.length} email(s) and ${mobiles.length} mobile(s)`);
      }
    }
  } catch (err) {
    console.error('Alert check failed:', err.message);
  }
};

// ================= SOCKET.IO =================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ================= READING PERSISTENCE =================
const persistReading = async (sensorData) => {
  const readingDoc = await db.insertDoc('sensor_readings', {
    sensor_id: 1,
    reading_value: 0,
    reading_unit: null,
    reading_time: new Date(),
    recorded_at: new Date(),
    ph: sensorData.ph,
    tds: sensorData.tds,
    turbidity: sensorData.turbidity
  });
  const reading = db.present(readingDoc, 'reading_id');
  io.emit('sensor-update', reading);
  await checkAndCreateAlert(sensorData);
  return reading;
};

// ================= CRON JOB (every hour by default) =================
cron.schedule(SENSOR_CRON, async () => {
  console.log('Generating sensor data...');
  try {
    const sensorData = generateSensorData();
    const saved = await persistReading(sensorData);
    console.log('Sensor data inserted:', JSON.stringify({
      reading_id: saved.reading_id, ph: saved.ph, tds: saved.tds, turbidity: saved.turbidity,
      recorded_at: saved.recorded_at
    }));
  } catch (err) {
    console.error('Error inserting sensor data:', err.message);
  }
});

// ================= TEST ROUTE =================
app.get('/api/test', (req, res) => {
  res.json({ message: "EnviroSense API is Running", version: "3.0.0", status: "healthy" });
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
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists ❌" });
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.insertDoc('users', {
      user_name: name,
      email,
      mobile_no: phone,
      password_hash: hashedPassword,
      village_name,
      language_preference: language_preference || 'mr',
      role: 'USER',
      status: 'ACTIVE',
      created_at: new Date()
    });
    logAction('User', 0, `New registration: ${email}`);
    res.json({ message: "Registered Successfully ✅" });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: "Error ❌" });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "All fields required ❌" });
  try {
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found ❌" });
    if (user.status === 'BLOCKED') return res.status(403).json({ message: "Account is blocked. Contact admin." });
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Wrong Password ❌" });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.user_name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Login Successful ✅", token,
      user: { id: user._id, name: user.user_name, email: user.email, role: user.role, village_name: user.village_name, language_preference: user.language_preference, mobile_no: user.mobile_no }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: "Database Error ❌" });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@nagaon.com' && password === 'admin123') {
    const token = jwt.sign({ id: 1, email, role: 'ADMIN', name: 'Admin' }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ message: "Admin Login Successful ✅", token, user: { id: 1, name: 'Admin', email, role: 'ADMIN' } });
  }
  try {
    const user = await db.collection('users').findOne({ email, role: 'ADMIN' });
    if (!user) return res.status(404).json({ message: "Admin not found ❌" });
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Wrong Password ❌" });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.user_name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Admin Login Successful ✅", token, user: { id: user._id, name: user.user_name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({ message: "Database Error ❌" });
  }
});

// ================= PROFILE ROUTES =================
app.get('/api/profile', authenticateToken, async (req, res) => {
  const user = await db.collection('users').findOne(
    { _id: Number(req.user.id) },
    { projection: { password_hash: 0 } }
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ data: db.present(user, 'id') });
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  const { name, phone, village_name, language_preference } = req.body;
  const updates = {};
  if (name !== undefined) updates.user_name = name;
  if (phone !== undefined) updates.mobile_no = phone;
  if (village_name !== undefined) updates.village_name = village_name;
  if (language_preference !== undefined) updates.language_preference = language_preference;
  if (Object.keys(updates).length === 0) return res.json({ message: "Profile updated successfully ✅" });
  await db.collection('users').updateOne({ _id: Number(req.user.id) }, { $set: updates });
  logAction('User', req.user.id, 'Profile updated');
  res.json({ message: "Profile updated successfully ✅" });
});

app.put('/api/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both passwords required ❌" });
  try {
    const user = await db.collection('users').findOne({ _id: Number(req.user.id) });
    if (!user) return res.status(404).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Current password is wrong ❌" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne({ _id: Number(req.user.id) }, { $set: { password_hash: hashed } });
    logAction('User', req.user.id, 'Password changed');
    res.json({ message: "Password changed successfully ✅" });
  } catch (e) {
    console.error('Change password error:', e.message);
    res.status(500).json({ message: "Error ❌" });
  }
});

// ================= SENSOR DATA ROUTES =================
app.get('/api/sensor-data/latest', async (req, res) => {
  const latest = await db.collection('sensor_readings').findOne({}, { sort: { recorded_at: -1 } });
  res.json({ data: latest ? db.present(latest, 'reading_id') : undefined });
});

app.get('/api/sensor-data', async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const rows = await db.collection('sensor_readings')
    .find({})
    .sort({ recorded_at: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();
  res.json({ data: db.presentAll(rows, 'reading_id') });
});

app.get('/api/sensor-data/charts', async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.collection('sensor_readings')
    .find({ recorded_at: { $gte: since } })
    .sort({ recorded_at: 1 })
    .toArray();
  res.json({ data: db.presentAll(rows, 'reading_id') });
});

app.post('/api/sensor-data', async (req, res) => {
  const { ph, tds, turbidity } = req.body;
  if (ph === undefined || tds === undefined || turbidity === undefined) {
    return res.status(400).json({ message: "ph, tds and turbidity are required ❌" });
  }
  const reading = await persistReading({ ph: Number(ph), tds: Number(tds), turbidity: Number(turbidity) });
  res.json({ message: "Sensor data inserted successfully ✅", data: reading });
});

// ================= CALENDAR DATA =================
app.get('/api/calendar-data', async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const rows = await db.collection('sensor_readings')
    .find({ recorded_at: { $gte: start, $lt: end } })
    .sort({ recorded_at: 1 })
    .toArray();

  const byDay = new Map();
  for (const r of rows) {
    const d = r.recorded_at;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(r);
  }

  const avg = (list, key) => {
    const values = list.map((r) => parseFloat(r[key])).filter((v) => !isNaN(v));
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  };

  const data = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      date,
      readings: list.length,
      avg_ph: avg(list, 'ph'),
      avg_tds: avg(list, 'tds') === null ? null : Math.round(avg(list, 'tds')),
      avg_turbidity: avg(list, 'turbidity')
    }));

  res.json({ data });
});

// ================= SYSTEM HEALTH =================
app.get('/api/system-health', async (req, res) => {
  try {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const readings = db.collection('sensor_readings');
    const [lastHourReadings, latest, activeAlerts, activeSensors, activeUsers, totalReadings] = await Promise.all([
      readings.countDocuments({ recorded_at: { $gte: oneHourAgo } }),
      readings.findOne({}, { sort: { recorded_at: -1 }, projection: { recorded_at: 1 } }),
      db.collection('alerts').countDocuments({ alert_status: 'Active' }),
      db.collection('water_sources').countDocuments({ source_status: 'Active' }),
      db.collection('users').countDocuments({ status: 'ACTIVE' }),
      readings.countDocuments({})
    ]);

    const lastReading = latest ? latest.recorded_at : null;
    const minutesSinceLastReading = lastReading ? Math.floor((now - new Date(lastReading).getTime()) / 60000) : -1;
    const status = minutesSinceLastReading < 20 ? 'healthy' : minutesSinceLastReading < 60 ? 'degraded' : 'down';

    res.json({
      data: {
        lastHourReadings, lastReading, activeAlerts, activeSensors, activeUsers, totalReadings,
        status, minutesSinceLastReading
      }
    });
  } catch (e) {
    console.error('System health error:', e.message);
    res.status(500).json({ message: "Health check failed" });
  }
});

// ================= VILLAGE COMPARISON =================
app.get('/api/village-comparison', async (req, res) => {
  try {
    const [sources, groups] = await Promise.all([
      db.collection('water_sources').find({}).sort({ village_name: 1 }).toArray(),
      db.collection('sensor_readings').aggregate([
        {
          $group: {
            _id: '$sensor_id',
            avg_ph: { $avg: '$ph' },
            avg_tds: { $avg: '$tds' },
            avg_turbidity: { $avg: '$turbidity' },
            reading_count: { $sum: 1 }
          }
        }
      ]).toArray()
    ]);

    const bySensor = new Map(groups.map((g) => [g._id, g]));
    const round = (v, p) => (v === null || v === undefined ? null : Math.round(v * p) / p);

    const data = sources.map((s) => {
      const g = bySensor.get(s.source_id) || bySensor.get(s._id) || {};
      return {
        village_name: s.village_name,
        source_name: s.source_name,
        source_type: s.source_type,
        avg_ph: round(g.avg_ph, 100),
        avg_tds: g.avg_tds === undefined ? null : Math.round(g.avg_tds),
        avg_turbidity: round(g.avg_turbidity, 100),
        reading_count: g.reading_count || 0
      };
    });
    res.json({ data });
  } catch (e) {
    console.error('Village comparison error:', e.message);
    res.status(500).json({ message: "Database Error ❌" });
  }
});

// ================= STATS =================
app.get('/api/stats', async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalReadings, totalUsers, activeAlerts, pendingQueries, activeSources, todayReadings] = await Promise.all([
      db.collection('sensor_readings').countDocuments({}),
      db.collection('users').countDocuments({ role: 'USER' }),
      db.collection('alerts').countDocuments({ alert_status: 'Active' }),
      db.collection('queries').countDocuments({ status: 'Pending' }),
      db.collection('water_sources').countDocuments({ source_status: 'Active' }),
      db.collection('sensor_readings').countDocuments({ recorded_at: { $gte: oneDayAgo } })
    ]);
    res.json({ data: { totalReadings, totalUsers, activeAlerts, pendingQueries, activeSources, todayReadings } });
  } catch (e) {
    console.error('Stats error:', e.message);
    res.status(500).json({ message: "Stats fetch failed" });
  }
});

// ================= CSV EXPORT =================
app.get('/api/csv-export', authenticateToken, async (req, res) => {
  try {
    const rows = await fetchReadingsByDate(req);
    const thresholds = await loadThresholdMap();
    const statusFor = (r) => {
      const unsafe = ['ph', 'tds', 'turbidity'].some((key) => {
        const range = thresholds[key];
        const value = parseFloat(r[key]);
        return range && !isNaN(value) && (value < range.min || value > range.max);
      });
      return unsafe ? 'Unsafe' : 'Safe';
    };
    const headers = 'Date & Time,pH,TDS,Turbidity,Status\n';
    const lines = rows.map((r) =>
      `"${new Date(r.recorded_at).toLocaleString()}",${r.ph},${r.tds},${r.turbidity},"${statusFor(r)}"`
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=water-quality-export.csv`);
    res.send('﻿' + headers + lines.join('\n'));
  } catch (e) {
    console.error('CSV export error:', e.message);
    res.status(500).json({ message: "Database Error ❌" });
  }
});

// Shared helpers for date-filtered reading fetches
async function fetchReadingsByDate(req) {
  const { start_date, end_date } = req.query;
  const filter = {};
  if (start_date && end_date) {
    const start = new Date(start_date);
    // include the whole end day (old SQL comparison cut it off at midnight)
    const end = new Date(`${end_date}T23:59:59.999`);
    filter.recorded_at = { $gte: start, $lte: end };
  }
  const rows = await db.collection('sensor_readings').find(filter).sort({ recorded_at: -1 }).toArray();
  return db.presentAll(rows, 'reading_id');
}

async function loadThresholdMap() {
  const settings = await db.collection('settings').find({}).toArray();
  const map = {};
  for (const s of settings) {
    map[s.parameter_name === 'pH' ? 'ph' : s.parameter_name === 'TDS' ? 'tds' : 'turbidity'] = {
      min: Number(s.min_value),
      max: Number(s.max_value)
    };
  }
  return map;
}

// ================= ALERT ROUTES =================
app.get('/api/alerts', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  const rows = await db.collection('alerts').find({}).sort({ generated_at: -1 }).limit(limit).toArray();
  res.json({ data: db.presentAll(rows, 'alert_id') });
});

app.get('/api/alerts/unresolved', authenticateToken, async (req, res) => {
  const rows = await db.collection('alerts').find({ alert_status: 'Active' }).sort({ generated_at: -1 }).toArray();
  res.json({ data: db.presentAll(rows, 'alert_id') });
});

app.put('/api/alerts/:id/resolve', authenticateToken, authenticateAdmin, async (req, res) => {
  await db.collection('alerts').updateOne({ _id: Number(req.params.id) }, { $set: { alert_status: 'Resolved' } });
  res.json({ message: "Alert resolved successfully ✅" });
});

// ================= USER MANAGEMENT ROUTES (ADMIN) =================
app.get('/api/users', authenticateToken, authenticateAdmin, async (req, res) => {
  const rows = await db.collection('users').find({}, { projection: { password_hash: 0 } }).sort({ created_at: -1 }).toArray();
  res.json({
    data: rows.map((u) => {
      const out = db.present(u, 'id');
      out.name = out.user_name;
      out.phone = out.mobile_no;
      return out;
    })
  });
});

app.put('/api/users/:id/block', authenticateToken, authenticateAdmin, async (req, res) => {
  await db.collection('users').updateOne({ _id: Number(req.params.id) }, { $set: { status: 'BLOCKED' } });
  logAction('Admin', req.user.id, `Blocked user ${req.params.id}`);
  res.json({ message: "User blocked successfully ✅" });
});

app.put('/api/users/:id/unblock', authenticateToken, authenticateAdmin, async (req, res) => {
  await db.collection('users').updateOne({ _id: Number(req.params.id) }, { $set: { status: 'ACTIVE' } });
  logAction('Admin', req.user.id, `Unblocked user ${req.params.id}`);
  res.json({ message: "User unblocked successfully ✅" });
});

app.delete('/api/users/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  await db.collection('users').deleteOne({ _id: Number(req.params.id) });
  logAction('Admin', req.user.id, `Deleted user ${req.params.id}`);
  res.json({ message: "User deleted successfully ✅" });
});

// ================= SETTINGS ROUTES =================
app.get('/api/settings', async (req, res) => {
  const rows = await db.collection('settings').find({}).sort({ _id: 1 }).toArray();
  res.json({ data: db.presentAll(rows, 'id') });
});

app.put('/api/settings/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  const { min_value, max_value } = req.body;
  await db.collection('settings').updateOne(
    { _id: Number(req.params.id) },
    { $set: { min_value: Number(min_value), max_value: Number(max_value), updated_at: new Date() } }
  );
  logAction('Admin', req.user.id, `Updated setting ${req.params.id}`);
  res.json({ message: "Setting updated successfully ✅" });
});

// ================= REPORT ROUTES =================
app.get('/api/report/data', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    res.json({ data: await fetchReadingsByDate(req) });
  } catch (e) {
    console.error('Report data error:', e.message);
    res.status(500).json({ message: "Database Error ❌" });
  }
});

// ================= QUERIES ROUTES =================
app.post('/api/queries', authenticateToken, async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ message: "Subject and message required ❌" });
  await db.insertDoc('queries', {
    user_id: Number(req.user.id),
    user_name: req.user.name,
    user_email: req.user.email,
    subject,
    message,
    status: 'Pending',
    created_at: new Date()
  });
  logAction('User', req.user.id, `Submitted query: ${subject}`);
  res.json({ message: "Query submitted successfully ✅" });
});

app.get('/api/queries', authenticateToken, authenticateAdmin, async (req, res) => {
  const rows = await db.collection('queries').find({}).sort({ created_at: -1 }).toArray();
  res.json({ data: db.presentAll(rows, 'id') });
});

app.put('/api/queries/:id/resolve', authenticateToken, authenticateAdmin, async (req, res) => {
  await db.collection('queries').updateOne({ _id: Number(req.params.id) }, { $set: { status: 'Resolved' } });
  res.json({ message: "Query resolved ✅" });
});

// ================= USER DATA ROUTE =================
app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    res.json({ data: await fetchReadingsByDate(req) });
  } catch (e) {
    console.error('User data error:', e.message);
    res.status(500).json({ message: "Database Error ❌" });
  }
});

// ================= WATER SOURCES =================
app.get('/api/water-sources', async (req, res) => {
  const rows = await db.collection('water_sources').find({ source_status: 'Active' }).sort({ village_name: 1 }).toArray();
  res.json({ data: db.presentAll(rows, 'source_id') });
});

// ================= SYSTEM LOGS =================
app.get('/api/logs', authenticateToken, authenticateAdmin, async (req, res) => {
  const rows = await db.collection('system_logs').find({}).sort({ action_time: -1 }).limit(100).toArray();
  res.json({ data: db.presentAll(rows, 'log_id') });
});

// ================= NOTIFICATIONS =================
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const [activeAlerts, pendingQueries] = await Promise.all([
      db.collection('alerts').countDocuments({ alert_status: 'Active' }),
      db.collection('queries').countDocuments({ user_id: Number(req.user.id), status: 'Pending' })
    ]);
    const notifications = [];
    if (activeAlerts > 0) notifications.push({ type: 'danger', count: activeAlerts, message: `${activeAlerts} active water quality alerts` });
    if (pendingQueries > 0) notifications.push({ type: 'info', count: pendingQueries, message: `${pendingQueries} pending queries` });
    res.json({ data: notifications });
  } catch (e) {
    console.error('Notifications error:', e.message);
    res.status(500).json({ message: "Failed" });
  }
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
app.get('/api/summary', async (req, res) => {
  try {
    const [totalReadings, totalUsers, activeAlerts, totalSources, recent] = await Promise.all([
      db.collection('sensor_readings').countDocuments({}),
      db.collection('users').countDocuments({ role: 'USER' }),
      db.collection('alerts').countDocuments({ alert_status: 'Active' }),
      db.collection('water_sources').countDocuments({}),
      db.collection('sensor_readings').find({}).sort({ recorded_at: -1 }).limit(12).toArray()
    ]);
    res.json({
      data: {
        totalReadings,
        totalUsers,
        activeAlerts,
        totalSources,
        recentReadings: db.presentAll(recent, 'reading_id')
      }
    });
  } catch (e) {
    console.error('Summary error:', e.message);
    res.json({ data: { totalReadings: 0, totalUsers: 0, activeAlerts: 0, totalSources: 0, recentReadings: [] } });
  }
});

// ================= DEFAULT DATA SEED =================
const ensureDefaults = async () => {
  // Safe-range settings for the three monitored parameters
  const defaultSettings = [
    { parameter_name: 'pH', min_value: 6.5, max_value: 8.5, unit: 'pH' },
    { parameter_name: 'TDS', min_value: 50, max_value: 300, unit: 'ppm' },
    { parameter_name: 'Turbidity', min_value: 0, max_value: 5, unit: 'NTU' }
  ];
  for (const s of defaultSettings) {
    const exists = await db.collection('settings').findOne({ parameter_name: s.parameter_name });
    if (!exists) {
      await db.insertDoc('settings', { ...s, updated_at: new Date() });
      console.log(`Seeded setting: ${s.parameter_name}`);
    }
  }

  // Default admin account (same credentials as before)
  const adminExists = await db.collection('users').findOne({ email: 'admin@nagaon.com' });
  if (!adminExists) {
    await db.insertDoc('users', {
      user_name: 'Admin',
      email: 'admin@nagaon.com',
      mobile_no: '0000000000',
      password_hash: await bcrypt.hash('admin123', 10),
      village_name: 'Nagaon',
      language_preference: 'en',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: new Date()
    });
    console.log('Seeded admin user: admin@nagaon.com / admin123');
  }

  // Field monitoring station shown on the landing page (Nagaon, Maharashtra)
  const stationExists = await db.collection('water_sources').findOne({ source_name: 'Nagaon Well' });
  if (!stationExists) {
    // rename any legacy name in place if it already exists
    const legacyStation = await db.collection('water_sources').findOne({
      source_name: { $in: ['Nagaon Hostel Well', 'Ashta Hostel Well'] }
    });
    if (legacyStation) {
      await db.collection('water_sources').updateOne(
        { _id: legacyStation._id },
        { $set: { source_name: 'Nagaon Well', village_name: 'Nagaon' } }
      );
      console.log(`Renamed water source: ${legacyStation.source_name} → Nagaon Well`);
    } else {
      await db.insertDoc('water_sources', {
        source_name: 'Nagaon Well',
        source_type: 'Well',
        village_name: 'Nagaon',
        latitude: 16.924062,
        longitude: 74.355358,
        description_text: 'Field monitoring station — pH, TDS and turbidity sensors with GPS-logged sampling point.',
        source_status: 'Active',
        created_by: 1,
        created_at: new Date()
      });
      console.log('Seeded water source: Nagaon Well');
    }
  }
};

// ================= START SERVER =================
(async () => {
  try {
    await db.connect();
    await ensureDefaults();

    // Continue the simulation from the newest stored reading
    const latest = await db.collection('sensor_readings').findOne({}, { sort: { recorded_at: -1 } });
    seedState(latest);

    server.listen(PORT, () => {
      console.log(`EnviroSense v3.0 Backend running on port ${PORT} 🚀`);
      console.log(`Database: MongoDB (pH · TDS · Turbidity only)`);
      console.log(`Sensor simulation active (every hour, slight realistic drift)`);
      console.log(`WebSocket ready for real-time updates`);
    });
  } catch (err) {
    console.error('Failed to start backend:', err);
    process.exit(1);
  }
})();
