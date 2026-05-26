# 🌊 EnviroSense v2.0 - Industry-Grade Water Quality Monitoring System

**Real-time IoT water quality monitoring** for the Nagaon River basin. A production-ready, bilingual (English/Marathi) environmental monitoring platform with WebSocket real-time updates, smart analytics, multi-village support, and comprehensive user/admin dashboards.

---

## 🚀 Key Features

### Real-Time Monitoring
- **WebSocket live updates** — Data pushes instantly to all connected clients
- **6 water parameters** — pH, TDS, Turbidity, Dissolved Oxygen, Temperature, Water Level
- **Water Quality Index (WQI)** — Composite scoring with Excellent/Good/Fair/Poor rating
- **Professional sensor simulation** — Seasonal patterns, time-of-day temperature curves, gradual drift

### Alert & Emergency System
- **Multi-level alerts** — MEDIUM/HIGH/CRITICAL severity levels
- **Bilingual alert messages** — English + Marathi
- **EmergencyAlert popup** — Full-screen red alert with safety guidelines for Critical events
- **Anti-spam** — Same alert not repeated within 1 hour
- **Notification Bell** — Real-time notification dropdown with count badge

### Smart Panels
- **📊 Dashboard** — WQI gauge, 6 parameter cards with Safe/Unsafe status, Chart.js trend charts
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
- **Parameterized SQL** — Prevents injection attacks
- **Account blocking** — Admin can block/unblock users

### Accessibility
- **Bilingual UI** — Full English + Marathi (मराठी) support
- **Responsive design** — Works on mobile, tablet, desktop
- **Large text readability** — Clear typography for all users

---

## 📁 Project Structure

```
envirosense-project/
├── backend/
│   ├── server.js          # Express + Socket.io server (22+ API endpoints)
│   ├── db.js              # MySQL database connection
│   ├── package.json       # Dependencies
│   └── .env               # Environment variables
├── dashboard-ui/
│   ├── src/
│   │   ├── App.js         # React Router (7 routes)
│   │   ├── App.css        # Complete theme (glassmorphism, animations)
│   │   ├── i18n.js        # English/Marathi translations (150+ keys)
│   │   ├── Landing.js     # Landing page with live chart preview
│   │   ├── LoginChoice.js # Role selection (User/Admin)
│   │   ├── Login.js       # User login
│   │   ├── AdminLogin.js  # Admin login
│   │   ├── Register.js    # User registration
│   │   ├── Dashboard.js   # User dashboard (WQI, charts, history, health, calendar, village)
│   │   ├── AdminDashboard.js # Admin panel (users, alerts, settings, reports, logs)
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
| Backend | Node.js + Express 4 | REST API server (22+ endpoints) |
| Database | MySQL 8.0 | Data persistence (6+ tables) |
| Auth | JWT + bcrypt | Secure authentication |
| Reports | jsPDF + CSV | Data export in multiple formats |
| Scheduling | node-cron | Automatic data generation every 10 min |
| i18n | i18next | Full English/Marathi UI |

---

## 📊 Database Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | user_id, user_name, email, password_hash, role, status, village_name |
| `sensor_readings` | Water quality data | reading_id, ph, tds, turbidity, dissolved_oxygen, temperature, water_level, recorded_at |
| `alerts` | Water quality alerts | alert_id, parameter_name, alert_message_en/mr, measured_value, alert_status, generated_at |
| `settings` | Safe parameter thresholds | id, parameter_name, min_value, max_value, unit |
| `queries` | User suggestions | id, user_id, subject, message, status |
| `water_sources` | Water source locations | source_id, source_name, village_name, source_type, source_status |
| `system_logs` | Admin audit trail | log_id, user_role, action_text, action_time |

---

## 🚦 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/test` | GET | - | API health check (v2.0) |
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

---

## 🔌 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client | Client connected |
| `disconnect` | Client | Client disconnected |
| `sensor-update` | Server→Client | New sensor reading (every 10 min) |
| `new-alert` | Server→Client | New alert created |
| `notification` | Server→Client | Push notification |

---

## 🧪 Sensor Simulation

The system includes a professional-grade sensor simulation engine:

- **Gradual drift** — Values change by small increments, no random jumps
- **Time-of-day pattern** — Temperature follows sinusoidal curve (cooler night, warmer day)
- **Seasonal variation** — Summer (higher temp/lower water), Monsoon (higher turbidity/water level), Winter (lower temp)
- **Self-correcting** — Values naturally pull back toward realistic centers if drifting too far
- **10-minute interval** — Cron job generates data at 00,10,20,30,40,50 of every hour

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0
- npm

### 1. Database Setup
```sql
CREATE DATABASE envirosense_system;
-- Import from SQL dump or let the app create tables
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env if needed (MySQL password: 2918)
node server.js
# Starts on port 5000
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
