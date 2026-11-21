# 🌊 EnviroSense v3.0 - Industry-Grade Water Quality Monitoring System

**Real-time IoT water quality monitoring** for the Nagaon River basin. A production-ready, bilingual (English/Marathi) environmental monitoring platform with WebSocket real-time updates, smart analytics, multi-village support, and comprehensive user/admin dashboards.

---

## 🚀 Key Features

### Real-Time Monitoring
- **WebSocket live updates** — Data pushes instantly to all connected clients
- **3 water parameters** — pH, TDS and Turbidity (the only monitored parameters)
- **Water Quality Index (WQI)** — Composite scoring with Excellent/Good/Fair/Poor rating
- **Professional sensor simulation** — A new reading every hour that changes only slightly from the previous one, so the data looks like a real probe (tiny jitter around a slowly moving, season- and time-of-day-aware baseline)

### Alert & Emergency System
- **Multi-level alerts** — MEDIUM/HIGH/CRITICAL severity levels
- **Bilingual alert messages** — English + Marathi
- **EmergencyAlert popup** — Full-screen red alert with safety guidelines for Critical events
- **Anti-spam** — Same alert not repeated within 1 hour
- **Notification Bell** — Real-time notification dropdown with count badge

### Smart Panels
- **📊 Dashboard** — WQI gauge, 3 parameter cards with Safe/Unsafe status
- **📋 Download History** — Date range search, PDF export, CSV export with per-parameter safety
- **📅 Water Calendar** — Monthly calendar view with color-coded safe/alert days, daily average
- **🔋 System Health** — Live health monitoring, connected sensors, active users, last reading time
- **🏘️ Village Comparison** — Compare water quality across multiple villages and water sources
- **⚙️ Profile Settings** — Edit name/phone/village, change password

### Admin Panel
- **User Management** — View/Block/Unblock/Delete users with status indicators
- **Alert Management** — View and resolve alerts with bilingual messages
- **Settings** — Configure safe thresholds for all parameters (auto-save)
- **PDF Reports** — Generate detailed reports with per-parameter ✓/✗ status
- **System Logs** — Complete audit trail of all admin actions
- **Queries** — View and resolve user-submitted suggestions

### Security
- **JWT authentication** — 7-day expiry tokens
- **bcrypt password hashing** — 10 salt rounds
- **Role-based access** — USER vs ADMIN roles
- **MongoDB document storage** — No raw SQL anywhere in the application
- **Account blocking** — Admin can block/unblock users

### Accessibility
- **Bilingual UI** — Full English + Marathi (मराठी) support
- **Responsive design** — Works on mobile, tablet, desktop
- **Large text readability** — Clear typography for all users

### 🆕 New in v2.1 (added without changing existing features)

- **🔮 6-Hour Forecast** — New dashboard card that predicts pH, TDS and turbidity for the next 6 hours from the most recent readings, and marks any hour expected to leave the safe range (no graph — text cards only)
- **🏞️ Community Issue Reporting** — Users report pollution, dumping, blocked drains or odour for a specific water source, optionally with a photo; users see status + authority reply, admins get a new **Community Reports** tab to resolve or dismiss
- **📗 Excel + 🧾 JSON Export** — New export buttons next to the existing PDF/CSV downloads; the `.xlsx` file has styled Readings and Summary sheets with per-parameter Safe/Unsafe status, the `.json` file is API-friendly
- **📱 Installable PWA + offline mode** — App can be installed on a phone/desktop, has app icons, theme colour and shortcuts, and loads from cache when the network is unavailable (push notifications keep working)
- **📧 Email + SMS alerts for CRITICAL events** — No separate sign-up: a CRITICAL reading automatically emails **every registered user** bilingual "what to do" recommendations and SMS-es every mobile number on file, in addition to in-app, WebSocket and Web Push alerts (opt-in via SMTP settings in `backend/.env`)

### 🆕 New in v3.0

- **🍃 MongoDB everywhere** — The whole database layer (users, readings, alerts, settings, queries, water sources, logs, community reports) now runs on MongoDB; MySQL was removed completely. A one-time script (`database/migrate-mysql-to-mongo.js`) copies existing MySQL data across.
- **🔬 pH · TDS · Turbidity only** — All six parameters were reduced to the three that matter: pH, TDS and Turbidity (dashboard cards, alerts, thresholds, forecasts, exports, calendar and reports all follow).
- **⏱️ Realistic hourly readings** — Every hour the simulator produces a new reading that differs only slightly from the previous one (≈ ±0.05 pH, ±3 ppm TDS, ±0.07 NTU), so trends look like a real sensor.
- **📍 Field station photo** — The landing page now shows the real Nagaon monitoring station photo with GPS coordinates (Lat 16.924062°, Long 74.355358°) and a Google Maps link.

---

## 📁 Project Structure

```
envirosense-project/
├── backend/
│   ├── server.js          # Express + Socket.io server (22+ API endpoints)
│   ├── db.js              # MongoDB connection + helpers (ids, doc shaping)
│   ├── routes/
│   │   ├── exports.js     # Excel (.xlsx) and JSON export endpoints
│   │   ├── communityReports.js # Community issue reports + photo uploads
│   │   └── alertSubscribers.js # Public critical-alert email/SMS registration
│   ├── services/
│   │   ├── sensorSimulator.js # 3-parameter realistic reading generator (hourly)
│   │   ├── emailAlerts.js # CRITICAL alert emails (subscribers + admin, bilingual)
│   │   ├── recommendations.js # "What to do" advice engine (EN + मराठी)
│   │   └── smsAlerts.js   # SMS to registered mobiles (Twilio / demo mode)
│   ├── uploads/           # Report photos (git-ignored)
│   ├── package.json       # Dependencies
│   └── .env               # Environment variables
├── database/
│   └── migrate-mysql-to-mongo.js # One-time MySQL → MongoDB migration
├── dashboard-ui/
│   ├── src/
│   │   ├── App.js         # React Router (7 routes)
│   │   ├── App.css        # Complete theme (glassmorphism, animations)
│   │   ├── i18n.js        # English/Marathi translations (150+ keys)
│   │   ├── Landing.js     # Landing page
│   │   ├── LoginChoice.js # Role selection (User/Admin)
│   │   ├── Login.js       # User login
│   │   ├── AdminLogin.js  # Admin login
│   │   ├── Register.js    # User registration
│   │   ├── Dashboard.js   # User dashboard (WQI, forecast, history, health, calendar)
│   │   ├── ForecastCard.js  # Next 6 hours parameter forecast
│   │   ├── ReportIssue.js   # Community issue reporting form
│   │   ├── AdminDashboard.js # Admin panel (users, alerts, reports, settings, logs)
│   │   ├── EmergencyAlert.js # Full-screen critical alert popup with safety guidelines
│   │   ├── NotificationBell.js # Real-time notification dropdown
│   │   ├── WaterCalendar.js # Monthly water quality calendar view
│   │   ├── ProfileSettings.js # User profile edit and password change
│   │   └── SuggestionForm.js # User query submission form
│   ├── package.json
│   └── public/
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + CSS3 | User interface with glassmorphism design |
| Real-time | Socket.io (WebSocket) | Live data streaming to all clients |
| Charts | Chart.js + react-chartjs-2 | Interactive trend graphs |
| Backend | Node.js + Express 5 | REST API server (22+ endpoints) |
| Database | MongoDB (mongodb driver) | Document persistence (9 collections) |
| Auth | JWT + bcrypt | Secure authentication |
| Reports | jsPDF + CSV | Data export in multiple formats |
| Scheduling | node-cron | Automatic data generation every hour |
| i18n | i18next | Full English/Marathi UI |

---

## 📊 Database Schema (MongoDB)

Database: `envirosense_system` (see `MONGODB_URI` / `DB_NAME` in `backend/.env`). Ids stay numeric to match the original API.

| Collection | Purpose | Key Fields |
|-------|---------|-------------|
| `users` | User accounts | _id, user_name, email, password_hash, role, status, village_name |
| `sensor_readings` | Water quality data | _id, ph, tds, turbidity, sensor_id, recorded_at |
| `alerts` | Water quality alerts | _id, parameter_name, alert_message_en/mr, measured_value, alert_status, generated_at |
| `settings` | Safe parameter thresholds | _id, parameter_name (pH / TDS / Turbidity), min_value, max_value, unit |
| `queries` | User suggestions | _id, user_id, subject, message, status |
| `water_sources` | Water source locations | _id, source_name, village_name, source_type, latitude, longitude, source_status |
| `system_logs` | Admin audit trail | _id, user_role, action_text, action_time |
| `community_reports` | Issue reports + photos | _id, user_id, category, description, photo_url, status |
| `counters` | Auto-increment id sequences | _id (collection name), seq |

---

## 🚦 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/test` | GET | - | API health check (v3.0) |
| `/api/health` | GET | - | System health with connected clients |
| `/api/register` | POST | - | User registration (bcrypt hashed) |
| `/api/login` | POST | - | User login (JWT token) |
| `/api/admin/login` | POST | - | Admin login (hardcoded + DB) |
| `/api/profile` | GET/PUT | Token | Get/Update user profile |
| `/api/change-password` | PUT | Token | Change user password |
| `/api/sensor-data` | GET | - | Sensor readings (paginated) |
| `/api/sensor-data/latest` | GET | - | Latest single reading |
| `/api/sensor-data/charts` | GET | - | Last 24 hours for charts |
| `/api/sensor-data` | POST | - | Manual sensor data input |
| `/api/calendar-data` | GET | - | Daily averages for calendar |
| `/api/system-health` | GET | - | System health metrics |
| `/api/village-comparison` | GET | - | Multi-village comparison |
| `/api/stats` | GET | - | Summary statistics |
| `/api/summary` | GET | - | Landing page data |
| `/api/csv-export` | GET | Token | CSV data export |
| `/api/alerts` | GET | Token | All alerts |
| `/api/alerts/unresolved` | GET | Token | Active alerts |
| `/api/alerts/:id/resolve` | PUT | Admin | Resolve alert |
| `/api/users` | GET | Admin | All users |
| `/api/users/:id/block` | PUT | Admin | Block user |
| `/api/users/:id/unblock` | PUT | Admin | Unblock user |
| `/api/users/:id` | DELETE | Admin | Delete user |
| `/api/settings` | GET | - | Safe thresholds |
| `/api/settings/:id` | PUT | Admin | Update threshold |
| `/api/report/data` | GET | Admin | Report data |
| `/api/queries` | GET/POST | Auth | User queries |
| `/api/queries/:id/resolve` | PUT | Admin | Resolve query |
| `/api/user/data` | GET | Token | User data by date range |
| `/api/water-sources` | GET | - | Active water sources |
| `/api/logs` | GET | Admin | System audit logs |
| `/api/notifications` | GET | Token | Notification count |
| `/api/export/xlsx` | GET | Token | Excel workbook export (Readings + Summary sheets) |
| `/api/export/json` | GET | Token | JSON export with per-parameter status |
| `/api/community-reports` | GET/POST | Token | List / submit community issue reports (photo upload) |
| `/api/community-reports/all` | GET | Admin | All community reports |
| `/api/community-reports/:id` | PUT | Admin | Resolve or dismiss a report |
| `/api/community-reports/categories` | GET | - | Available report categories |
| `/api/uploads/:file` | GET | - | Report photo |
| `/api/email-alert-status` | GET | - | Whether email alerts are configured |
| `/api/alert-subscribers` | POST | - | Register for critical email/SMS alerts (name, email, mobile) |
| `/api/alert-subscribers` | GET | Admin | List registered subscribers |
| `/api/alert-subscribers/:id` | DELETE | Admin | Remove a subscriber |

---

## 🔌 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client | Client connected |
| `disconnect` | Client | Client disconnected |
| `sensor-update` | Server→Client | New sensor reading (every hour) |
| `new-alert` | Server→Client | New alert created |
| `notification` | Server→Client | Push notification |

### Critical alert notifications (email + SMS)

When a reading goes **CRITICAL**, the real notification chain kicks in — not just an in-app popup. **No separate sign-up is needed:** every registered app user is notified automatically.

1. **All registered users are notified** — on a CRITICAL reading the system emails **every active user account** (plus any landing-page subscribers and `ALERT_EMAIL_TO` addresses) and sends an **SMS to every mobile number on file** (user profiles + subscribers), plus the in-app/WebSocket/Web Push broadcast to everyone online.
2. **Every alert email contains** the measured value, safe range, detection time and a bilingual **"✅ What you should do / काय करावे"** list — parameter-specific advice for pH, TDS and turbidity (English + मराठी), e.g. *"Water is cloudy or muddy — do not drink it as-is / पाणी चिकट किंवा गळगळीत आहे — तसेच प्यायचे नको"*
3. **No separate sign-up needed** — the email and mobile number stored in each user's account (collected once at normal registration) are used automatically. Extra recipients without accounts can be added via `POST /api/alert-subscribers` and managed in the Admin Panel → 🚨 Alerts tab.

Enable real email delivery with SMTP (e.g. a Gmail App Password) in `backend/.env`, then restart the backend:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=EnviroSense <your.email@gmail.com>
ALERT_EMAIL_TO=admin@nagaon.com   # optional permanent copy for the water authority
```

Optional SMS delivery (Twilio) in `backend/.env`:

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
SMS_FROM=+91XXXXXXXXXX
```

Without SMTP/SMS configuration the system runs in **demo mode**: every email and SMS is logged in full on the backend console, so the complete flow stays visible without any paid gateway. Check the current state with `GET /api/email-alert-status` (`email: configured|demo`, `sms: configured|demo`).

---

## 🧪 Sensor Simulation

The system includes a professional-grade sensor simulation engine (`backend/services/sensorSimulator.js`):

- **Only 3 parameters** — pH, TDS and Turbidity
- **Slight change every reading** — Maximum step per hourly sample is ≈0.05 pH, 3 ppm TDS and 0.07 NTU, so consecutive readings always look close together
- **Time-of-day pattern** — A slow sinusoidal baseline (pH/TDS wobble through the day)
- **Seasonal variation** — Monsoon raises turbidity, summer raises TDS, etc.
- **Self-correcting** — Values naturally pull back toward realistic centers if drifting too far, and hard clamps keep them inside realistic sensor limits
- **Warm start** — On server boot the simulator continues from the newest stored reading
- **Hourly interval** — Cron job generates a reading at minute 00 of every hour (override with `SENSOR_CRON` in `backend/.env`)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+ running locally (`mongodb://localhost:27017`)
- npm

### 1. Database
Nothing to create by hand — the backend connects to MongoDB on startup and seeds the default settings, admin account and Nagaon station automatically.

Coming from the old MySQL version? Migrate your existing data once:

```bash
node database/migrate-mysql-to-mongo.js
# copies users, readings, alerts, settings, queries, sources and logs
# (keeps only pH / TDS / Turbidity data, and the original numeric ids)
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env if needed (MONGODB_URI, DB_NAME, PORT)
node server.js
# Starts on port 5000, new reading every hour
```

### 3. Frontend
```bash
cd dashboard-ui
npm install
npm start
# Starts on port 3000
```

### Demo Credentials
- **Admin:** admin@nagaon.com / admin123
- **User:** Register new account from landing page

---

## 🎯 Presentation Flow

See [PRESENTATION_GUIDE.md](./PRESENTATION_GUIDE.md) for complete step-by-step demo script.

**Quick path:**
1. Start backend → `node server.js`
2. Start frontend → `npm start`
3. Open http://localhost:3000
4. Landing → Login Choice → Register/Login → User Dashboard
5. Admin Login → Admin Dashboard

---

## 📝 License

Educational Project - Nagaon River Water Quality Monitoring System

---

Built with ❤️ for the Nagaon community
