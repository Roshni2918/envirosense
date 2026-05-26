import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import jsPDF from "jspdf";
import WaterSourcesMap from "./WaterSourcesMap";
import "./App.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

function AdminDashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const token = localStorage.getItem("token");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sensorData, setSensorData] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [settings, setSettings] = useState([]);
  const [queries, setQueries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [stats, setStats] = useState({ totalReadings: 0, totalUsers: 0, activeAlerts: 0, pendingQueries: 0, activeSources: 0, todayReadings: 0 });
  const [latestData, setLatestData] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/adminLogin");
  };

  const getParamStatus = (paramName, value) => {
    const ranges = { ph: { min: 6.5, max: 8.5 }, tds: { min: 50, max: 300 }, turbidity: { min: 0, max: 5 }, dissolved_oxygen: { min: 5, max: 8 }, temperature: { min: 20, max: 30 }, water_level: { min: 40, max: 100 } };
    const range = ranges[paramName];
    if (!range) return 'safe';
    return (value < range.min || value > range.max) ? 'unsafe' : 'safe';
  };

  const fetchSensorData = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/sensor-data?limit=50");
      const data = await res.json();
      if (data.data) {
        setSensorData(data.data);
        const reversed = [...data.data].reverse();
        setChartData({
          labels: reversed.map(r => new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          datasets: [
            { label: "pH", data: reversed.map(r => r.ph), borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,0.1)", fill: true, tension: 0.4, pointRadius: 2 },
            { label: "Temperature", data: reversed.map(r => r.temperature), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", fill: true, tension: 0.4, pointRadius: 2, yAxisID: "y1" }
          ]
        });
      }
    } catch (e) { console.error(e); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/users", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setUsers(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/alerts", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setAlerts(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/settings");
      const data = await res.json();
      if (data.data) setSettings(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchQueries = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/queries", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setQueries(data.data);
    } catch (e) { console.error(e); }
  };
  const fetchLatestData = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/sensor-data/latest");
      const data = await res.json();
      if (data.data) setLatestData(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/stats");
      const data = await res.json();
      if (data.data) setStats(data.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchLatestData(), fetchSensorData(), fetchUsers(), fetchAlerts(), fetchSettings(), fetchQueries(), fetchStats()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  const handleBlock = async (id) => {
    if (!window.confirm("Block this user?")) return;
    await fetch(`http://localhost:5000/api/users/${id}/block`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchUsers();
  };

  const handleUnblock = async (id) => {
    await fetch(`http://localhost:5000/api/users/${id}/unblock`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchUsers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;
    await fetch(`http://localhost:5000/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchUsers();
  };

  const handleResolveAlert = async (id) => {
    await fetch(`http://localhost:5000/api/alerts/${id}/resolve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchAlerts();
  };

  const handleResolveQuery = async (id) => {
    await fetch(`http://localhost:5000/api/queries/${id}/resolve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchQueries();
  };

  const updateSetting = async (id, min_value, max_value) => {
    await fetch(`http://localhost:5000/api/settings/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ min_value: parseFloat(min_value), max_value: parseFloat(max_value) })
    });
    fetchSettings();
  };

  const generatePDFReport = async () => {
    try {
      const params = (reportStartDate && reportEndDate) ? `?start_date=${reportStartDate}&end_date=${reportEndDate}` : '';
      const res = await fetch(`http://localhost:5000/api/report/data${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const rows = data.data || [];
      if (rows.length === 0) return alert("No data for the selected period");

      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(18); doc.text("EnviroSense - Water Quality Report", 20, 20);
      doc.setFontSize(10);
      doc.text(`Period: ${reportStartDate || 'All'} to ${reportEndDate || 'All'}`, 20, 30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 37);
      doc.text(`Admin: Admin`, 20, 44);
      doc.text(`Total Readings: ${rows.length}`, 20, 51);

      let y = 62; doc.setFontSize(7);
      const headers = ["#", "Date & Time", "pH", "St", "TDS", "St", "Turb", "St", "DO", "St", "Temp", "St", "W.Lvl", "St", "Overall"];
      const colX = [8, 18, 40, 48, 58, 66, 76, 84, 94, 102, 112, 120, 130, 138, 148];
      headers.forEach((h, i) => doc.text(h, colX[i], y));

      y += 5;
      rows.forEach((row, i) => {
        const safe = (p, v) => getParamStatus(p, v) === 'safe';
        const allSafe = safe('ph', row.ph) && safe('tds', row.tds) && safe('turbidity', row.turbidity) &&
          safe('dissolved_oxygen', row.dissolved_oxygen) && safe('temperature', row.temperature) && safe('water_level', row.water_level);
        doc.text(String(i + 1), colX[0], y);
        doc.text(new Date(row.recorded_at).toLocaleString(), colX[1], y);
        doc.text(String(row.ph || '-'), colX[2], y); doc.text(safe('ph', row.ph) ? '✓' : '✗', colX[3], y);
        doc.text(String(row.tds || '-'), colX[4], y); doc.text(safe('tds', row.tds) ? '✓' : '✗', colX[5], y);
        doc.text(String(row.turbidity || '-'), colX[6], y); doc.text(safe('turbidity', row.turbidity) ? '✓' : '✗', colX[7], y);
        doc.text(String(row.dissolved_oxygen || '-'), colX[8], y); doc.text(safe('dissolved_oxygen', row.dissolved_oxygen) ? '✓' : '✗', colX[9], y);
        doc.text(String(row.temperature || '-'), colX[10], y); doc.text(safe('temperature', row.temperature) ? '✓' : '✗', colX[11], y);
        doc.text(String(row.water_level || '-'), colX[12], y); doc.text(safe('water_level', row.water_level) ? '✓' : '✗', colX[13], y);
        doc.text(allSafe ? '✅ SAFE' : '⚠️ UNSAFE', colX[14], y);
        y += 4.5;
        if (y > 195) { doc.addPage(); y = 20; }
      });
      doc.save(`envirosense-report-${reportStartDate || 'all'}.pdf`);
    } catch (e) { alert("Failed to generate report"); }
  };

  const calcWQI = (data) => {
    const ranges = {
      ph: { min: 6.5, max: 8.5, weight: 0.2 },
      tds: { min: 50, max: 300, weight: 0.15 },
      turbidity: { min: 0, max: 5, weight: 0.15 },
      dissolved_oxygen: { min: 5, max: 8, weight: 0.2 },
      temperature: { min: 20, max: 30, weight: 0.15 },
      water_level: { min: 40, max: 100, weight: 0.15 }
    };
    let score = 0;
    for (const [key, r] of Object.entries(ranges)) {
      const val = parseFloat(data[key]);
      if (isNaN(val)) continue;
      const mid = (r.min + r.max) / 2;
      const dist = Math.abs(val - mid) / ((r.max - r.min) / 2);
      const paramScore = Math.max(0, 100 - dist * 100);
      score += paramScore * r.weight;
    }
    return Math.round(score);
  };

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'en' ? 'mr' : 'en');

  const parameters = latestData ? [
    { key: 'ph', name: t("ph"), value: latestData.ph, status: getParamStatus('ph', latestData.ph) },
    { key: 'tds', name: t("tds"), value: latestData.tds, status: getParamStatus('tds', latestData.tds) },
    { key: 'turbidity', name: t("turbidity"), value: latestData.turbidity, status: getParamStatus('turbidity', latestData.turbidity) },
    { key: 'dissolved_oxygen', name: t("dissolvedOxygen"), value: latestData.dissolved_oxygen, status: getParamStatus('dissolved_oxygen', latestData.dissolved_oxygen) },
    { key: 'temperature', name: t("temperature"), value: latestData.temperature, status: getParamStatus('temperature', latestData.temperature) },
    { key: 'water_level', name: t("waterLevel"), value: latestData.water_level, status: getParamStatus('water_level', latestData.water_level) }
  ] : [];

  const overallSafe = parameters.every(p => p.status === 'safe');
  const wqiScore = latestData ? calcWQI(latestData) : 0;
  const wqiLabel = wqiScore >= 90 ? 'Excellent' : wqiScore >= 70 ? 'Good' : wqiScore >= 50 ? 'Fair' : 'Poor';
  const wqiClass = wqiScore >= 90 ? 'excellent' : wqiScore >= 70 ? 'good' : wqiScore >= 50 ? 'fair' : 'poor';
  const wqiColor = wqiScore >= 90 ? '#10b981' : wqiScore >= 70 ? '#0ea5e9' : wqiScore >= 50 ? '#f59e0b' : '#ef4444';
  const wqiPercent = (wqiScore / 100) * 339.292;

  const tabs = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "sensors", icon: "📈", label: "Sensor Data" },
    { key: "users", icon: "👤", label: t("manageUsers") },
    { key: "alerts", icon: "🚨", label: t("viewAlerts") },
    { key: "queries", icon: "💬", label: "Queries" },
    { key: "reports", icon: "📋", label: t("generateReports") },
    { key: "settings", icon: "⚙️", label: t("settings") },
    { key: "map", icon: "🗺️", label: "Map" }
  ];

  const statCards = [
    { icon: '📊', value: stats.totalReadings, label: t("sensorName"), bg: '#dbeafe', color: '#0ea5e9' },
    { icon: '👤', value: stats.totalUsers, label: t("totalUsers"), bg: '#ede9fe', color: '#8b5cf6' },
    { icon: '🚨', value: stats.activeAlerts, label: t("activeAlerts"), bg: '#fef2f2', color: '#ef4444' },
    { icon: '💬', value: stats.pendingQueries, label: t("pendingQueries"), bg: '#fef3c7', color: '#f59e0b' },
    { icon: '🌊', value: stats.activeSources, label: t("waterSources"), bg: '#e0f2fe', color: '#0c4a6e' },
    { icon: '⏱️', value: stats.todayReadings, label: t("todayReadings"), bg: '#d1fae5', color: '#10b981' },
  ];

  return (
    <div className="dashboard-container">
      <div className="sidebar glass-sidebar">
        <div className="sidebar-header">
          <span style={{ fontSize: 32, display: 'block' }}>🌊</span>
          <h3>EnviroSense</h3>
          <p style={{ fontSize: 11, color: "#64748b" }}>Admin</p>
        </div>
        <ul>
          <li className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>
            <span>📊</span><span>Dashboard</span>
          </li>
          {tabs.map(tab => (
            <li key={tab.key} className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <button onClick={toggleLang} className="lang-toggle">{i18n.language === 'en' ? 'मराठी' : 'English'}</button>
        </div>
      </div>

      <div className="main-content">
        <div className="top-bar glass-topbar">
          <h1>🌊 Admin Dashboard</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {loading ? t("loading") : `● ${sensorData.length} readings loaded`}
            </span>
            <button className="btn-logout" onClick={handleLogout}>{t("logout")}</button>
          </div>
        </div>

        <div className="stats-cards">
          {statCards.map((s, i) => (
            <div key={i} className="stat-card glass-card">
              <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}><span>{s.icon}</span></div>
              <div className="stat-card-info"><h4>{s.value}</h4><p>{s.label}</p></div>
            </div>
          ))}
        </div>

        <div className="tab-bar">
          {tabs.map(tab => (
            <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}>{tab.icon} {tab.label}</button>
          ))}
        </div>

        <div className="admin-content glass-card">
          {/* DASHBOARD TAB - 6 PARAMETER CARDS */}
          {activeTab === "dashboard" && (
            <div>
              {latestData && (
                <>
                  <div className="wqi-gauge glass-card">
                    <div className="wqi-ring">
                      <svg viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                        <circle cx="60" cy="60" r="54" fill="none" stroke={wqiColor} strokeWidth="8"
                          strokeDasharray={`${wqiPercent} 339.292`} strokeLinecap="round" transform="rotate(-90 60 60)" />
                      </svg>
                      <div className="wqi-score">
                        <span className="wqi-score-value">{wqiScore}</span>
                        <span className="wqi-score-label">WQI</span>
                      </div>
                    </div>
                    <div className="wqi-info">
                      <h3>Water Quality Index</h3>
                      <p>Overall assessment based on all measured parameters</p>
                      <span className={`status-badge ${wqiClass}`}>{wqiLabel}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Last updated</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0c4a6e' }}>
                        {new Date(latestData.recorded_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="parameters">
                    {parameters.map((param, index) => (
                      <div className="param-box glass-card" key={index}
                        style={{ borderLeftColor: param.status === 'unsafe' ? '#ef4444' : '#10b981' }}>
                        <h3>{param.name}</h3>
                        <div className="param-value" style={{ color: param.status === 'unsafe' ? '#ef4444' : '#0c4a6e' }}>
                          {param.value}
                        </div>
                        <div className="param-unit">
                          {param.key === 'ph' ? 'pH' : param.key === 'tds' ? 'ppm' : param.key === 'turbidity' ? 'NTU' :
                           param.key === 'dissolved_oxygen' ? 'mg/L' : param.key === 'temperature' ? '°C' : '%'}
                        </div>
                        <div className={`param-status ${param.status}`}>
                          {param.status === 'safe' ? '✅ Safe' : '⚠️ Unsafe'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="water-status glass-card" style={{
                    background: overallSafe
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
                    borderColor: overallSafe ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
                  }}>
                    <h2 style={{ fontSize: 16 }}>💧 Water Quality Status</h2>
                    <div className={`status-display ${overallSafe ? 'safe' : 'unsafe'}`}
                      style={{ fontSize: 24 }}>
                      {overallSafe ? '✅ Safe' : '⚠️ Unsafe'}
                    </div>
                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                      {overallSafe
                        ? 'All water quality parameters are within safe ranges.'
                        : 'Some parameters exceed safe thresholds.'}
                    </p>
                  </div>
                </>
              )}
              {!latestData && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading sensor data...</div>}
            </div>
          )}

          {/* SENSORS TAB */}
          {activeTab === "sensors" && chartData && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3>📊 pH & Temperature Trends</h3>
                <Line data={chartData} options={{
                  responsive: true, interaction: { mode: "index", intersect: false },
                  plugins: { legend: { position: "top", labels: { usePointStyle: true } } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: false, title: { display: true, text: "pH" } },
                    y1: { position: "right", beginAtZero: false, title: { display: true, text: "Temperature (°C)" }, grid: { display: false } }
                  }
                }} />
              </div>
              <div className="table-container">
                <h2>📋 Recent Sensor Readings</h2>
                <table>
                  <thead><tr><th>Date & Time</th><th>pH</th><th>TDS</th><th>Turbidity</th><th>DO</th><th>Temp</th><th>W.Level</th></tr></thead>
                  <tbody>
                    {sensorData.slice(0, 15).map((row, i) => (
                      <tr key={i}>
                        <td>{new Date(row.recorded_at).toLocaleString()}</td>
                        <td>{row.ph}</td><td>{row.tds}</td><td>{row.turbidity}</td>
                        <td>{row.dissolved_oxygen}</td><td>{row.temperature}</td><td>{row.water_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="table-container">
              <h2>👤 {t("manageUsers")}</h2>
              <table>
                <thead><tr><th>ID</th><th>{t("name")}</th><th>{t("email")}</th><th>{t("phone")}</th><th>{t("village")}</th><th>Lang</th><th>Role</th><th>{t("status")}</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td><td>{u.name}</td><td>{u.email}</td><td>{u.phone}</td>
                      <td>{u.village_name}</td><td>{u.language_preference}</td><td>{u.role}</td>
                      <td><span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: u.status === 'ACTIVE' ? '#d1fae5' : u.status === 'BLOCKED' ? '#fee2e2' : '#f1f5f9',
                        color: u.status === 'ACTIVE' ? '#065f46' : u.status === 'BLOCKED' ? '#991b1b' : '#475569'
                      }}>{u.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {u.status !== 'BLOCKED'
                            ? <button className="btn-sm btn-danger" onClick={() => handleBlock(u.id)}>{t("blockUser")}</button>
                            : <button className="btn-sm btn-success" onClick={() => handleUnblock(u.id)}>{t("unblockUser")}</button>}
                          <button className="btn-sm btn-danger" onClick={() => handleDelete(u.id)}>{t("deleteUser")}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ALERTS TAB */}
          {activeTab === "alerts" && (
            <div className="table-container">
              <h2>🚨 {t("viewAlerts")}</h2>
              <table>
                <thead><tr><th>ID</th><th>Parameter</th><th>Message (EN)</th><th>Message (MR)</th><th>Value</th><th>{t("status")}</th><th>Time</th><th>Action</th></tr></thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.alert_id}>
                      <td>{a.alert_id}</td><td>{a.parameter_name}</td>
                      <td style={{ fontSize: 12 }}>{a.alert_message_en}</td>
                      <td style={{ fontSize: 12 }}>{a.alert_message_mr}</td>
                      <td>{a.measured_value}</td>
                      <td><span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: a.alert_status === 'Active' ? '#fee2e2' : '#d1fae5',
                        color: a.alert_status === 'Active' ? '#991b1b' : '#065f46'
                      }}>{a.alert_status}</span></td>
                      <td style={{ fontSize: 12 }}>{new Date(a.generated_at).toLocaleString()}</td>
                      <td>{a.alert_status === 'Active' && <button className="btn-sm btn-success" onClick={() => handleResolveAlert(a.alert_id)}>{t("resolveAlert")}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* QUERIES TAB */}
          {activeTab === "queries" && (
            <div className="table-container">
              <h2>💬 User Queries & Suggestions</h2>
              <table>
                <thead><tr><th>ID</th><th>User</th><th>Email</th><th>Subject</th><th>Message</th><th>{t("status")}</th><th>Time</th><th>Action</th></tr></thead>
                <tbody>
                  {queries.map(q => (
                    <tr key={q.id}>
                      <td>{q.id}</td><td>{q.user_name}</td><td>{q.user_email}</td>
                      <td><strong>{q.subject}</strong></td>
                      <td style={{ maxWidth: 200, fontSize: 12 }}>{q.message}</td>
                      <td><span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: q.status === 'Pending' ? '#fef3c7' : '#d1fae5',
                        color: q.status === 'Pending' ? '#92400e' : '#065f46'
                      }}>{q.status}</span></td>
                      <td style={{ fontSize: 12 }}>{new Date(q.created_at).toLocaleString()}</td>
                      <td>{q.status === 'Pending' && <button className="btn-sm btn-success" onClick={() => handleResolveQuery(q.id)}>Resolve</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === "reports" && (
            <div>
              <h3 style={{ marginBottom: 16 }}>📋 {t("generateReports")}</h3>
              <div className="history-fields" style={{ marginBottom: 20 }}>
                <div><label>Start Date</label><input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} /></div>
                <div><label>End Date</label><input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} /></div>
                <button className="btn-primary" onClick={generatePDFReport}>📥 {t("generatePDF")}</button>
              </div>
              <p style={{ fontSize: 13, color: '#64748b' }}>PDF includes per-parameter safety status (✓/✗) and overall assessment for each reading.</p>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div>
              <h3 style={{ marginBottom: 16 }}>⚙️ {t("settings")}</h3>
              <table>
                <thead><tr><th>Parameter</th><th>Min Value</th><th>Max Value</th><th>Unit</th><th>Action</th></tr></thead>
                <tbody>
                  {settings.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.parameter_name}</strong></td>
                      <td><input type="number" step="0.01" defaultValue={s.min_value}
                        onBlur={e => updateSetting(s.id, e.target.value, s.max_value)}
                        style={{ width: 80, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} /></td>
                      <td><input type="number" step="0.01" defaultValue={s.max_value}
                        onBlur={e => updateSetting(s.id, s.min_value, e.target.value)}
                        style={{ width: 80, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} /></td>
                      <td>{s.unit}</td>
                      <td><span style={{ fontSize: 12, color: '#10b981' }}>Auto-saved</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MAP TAB */}
          {activeTab === "map" && (
            <div>
              <h3 style={{ marginBottom: 16 }}>🗺️ Deployment Map — Nagaon Region</h3>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                Real monitoring stations across Nagaon, Ashta, Nagav, and Khanapur — click any source for Google Maps link
              </p>
              <WaterSourcesMap t={t} i18n={i18n} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
