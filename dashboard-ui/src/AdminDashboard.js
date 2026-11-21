import React, { useState, useEffect } from "react";
import API_URL from "./config";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import WaterSourcesMap from "./WaterSourcesMap";
import "./App.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const token = localStorage.getItem("token");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sensorData, setSensorData] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [queries, setQueries] = useState([]);
  const [communityReports, setCommunityReports] = useState([]);
  const [subscribers, setSubscribers] = useState([]);

  const [loading, setLoading] = useState(true);
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
    const ranges = { ph: { min: 6.5, max: 8.5 }, tds: { min: 50, max: 300 }, turbidity: { min: 0, max: 5 } };
    const range = ranges[paramName];
    if (!range) return 'safe';
    return (value < range.min || value > range.max) ? 'unsafe' : 'safe';
  };

  const fetchSensorData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sensor-data?limit=50`);
      const data = await res.json();
      if (data.data) {
        setSensorData(data.data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setUsers(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setAlerts(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchQueries = async () => {
    try {
      const res = await fetch(`${API_URL}/api/queries`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setQueries(data.data);
    } catch (e) { console.error(e); }
  };
  const fetchLatestData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sensor-data/latest`);
      const data = await res.json();
      if (data.data) setLatestData(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      const data = await res.json();
      if (data.data) setStats(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchCommunityReports = async () => {
    try {
      const res = await fetch(`${API_URL}/api/community-reports/all`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setCommunityReports(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchSubscribers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alert-subscribers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setSubscribers(data.data);
    } catch (e) { console.error(e); }
  };

  const handleUpdateReport = async (id, status) => {
    const note = status === 'Resolved'
      ? window.prompt('Add a short note for the user (optional):') || 'Issue resolved by the water authority'
      : null;
    await fetch(`${API_URL}/api/community-reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, admin_note: note })
    });
    fetchCommunityReports();
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchLatestData(), fetchSensorData(), fetchUsers(), fetchAlerts(), fetchQueries(), fetchStats(), fetchCommunityReports(), fetchSubscribers()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  const handleBlock = async (id) => {
    if (!window.confirm("Block this user?")) return;
    await fetch(`${API_URL}/api/users/${id}/block`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchUsers();
  };

  const handleUnblock = async (id) => {
    await fetch(`${API_URL}/api/users/${id}/unblock`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchUsers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;
    await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchUsers();
  };

  const handleResolveAlert = async (id) => {
    await fetch(`${API_URL}/api/alerts/${id}/resolve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchAlerts();
  };

  const handleDeleteSubscriber = async (id) => {
    if (!window.confirm("Remove this subscriber from critical alerts?")) return;
    await fetch(`${API_URL}/api/alert-subscribers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchSubscribers();
  };

  const handleResolveQuery = async (id) => {
    await fetch(`${API_URL}/api/queries/${id}/resolve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchQueries();
  };

  const generatePDFReport = async () => {
    try {
      const params = (reportStartDate && reportEndDate) ? `?start_date=${reportStartDate}&end_date=${reportEndDate}` : '';
      const res = await fetch(`${API_URL}/api/report/data${params}`, { headers: { Authorization: `Bearer ${token}` } });
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
      const headers = ["#", "Date & Time", "pH", "St", "TDS", "St", "Turb", "St", "Overall"];
      const colX = [8, 18, 45, 53, 63, 71, 81, 89, 100];
      headers.forEach((h, i) => doc.text(h, colX[i], y));

      y += 5;
      rows.forEach((row, i) => {
        const safe = (p, v) => getParamStatus(p, v) === 'safe';
        const allSafe = safe('ph', row.ph) && safe('tds', row.tds) && safe('turbidity', row.turbidity);
        doc.text(String(i + 1), colX[0], y);
        doc.text(new Date(row.recorded_at).toLocaleString(), colX[1], y);
        doc.text(String(row.ph || '-'), colX[2], y); doc.text(safe('ph', row.ph) ? '✓' : '✗', colX[3], y);
        doc.text(String(row.tds || '-'), colX[4], y); doc.text(safe('tds', row.tds) ? '✓' : '✗', colX[5], y);
        doc.text(String(row.turbidity || '-'), colX[6], y); doc.text(safe('turbidity', row.turbidity) ? '✓' : '✗', colX[7], y);
        doc.text(allSafe ? '✅ SAFE' : '⚠️ UNSAFE', colX[8], y);
        y += 4.5;
        if (y > 195) { doc.addPage(); y = 20; }
      });
      doc.save(`envirosense-report-${reportStartDate || 'all'}.pdf`);
    } catch (e) { alert("Failed to generate report"); }
  };

  const calcWQI = (data) => {
    const ranges = {
      ph: { min: 6.5, max: 8.5, weight: 0.4 },
      tds: { min: 50, max: 300, weight: 0.3 },
      turbidity: { min: 0, max: 5, weight: 0.3 }
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
    { key: 'turbidity', name: t("turbidity"), value: latestData.turbidity, status: getParamStatus('turbidity', latestData.turbidity) }
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
    { key: "community", icon: "🏞️", label: t("communityReports") },
    { key: "reports", icon: "📋", label: t("generateReports") },
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
          {/* DASHBOARD TAB - 3 PARAMETER CARDS */}
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
                          {param.key === 'ph' ? 'pH' : param.key === 'tds' ? 'ppm' : 'NTU'}
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
          {activeTab === "sensors" && (
            <div className="table-container">
              <h2>📋 Recent Sensor Readings</h2>
              <table>
                <thead><tr><th>Date & Time</th><th>pH</th><th>TDS</th><th>Turbidity</th></tr></thead>
                <tbody>
                  {sensorData.slice(0, 15).map((row, i) => (
                    <tr key={i}>
                      <td>{new Date(row.recorded_at).toLocaleString()}</td>
                      <td>{row.ph}</td><td>{row.tds}</td><td>{row.turbidity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

          {/* ALERT SUBSCRIBERS (registered for critical email / SMS) */}
          {activeTab === "alerts" && (
            <div className="table-container" style={{ marginTop: 20 }}>
              <h2>🔔 Alert Subscribers ({subscribers.length})</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 12px' }}>
                Extra recipients beyond the user accounts (added via the API, e.g. villagers without
                app accounts) — they join all registered users in receiving critical email/SMS alerts.
              </p>
              {subscribers.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8' }}>No subscribers yet.</p>
              ) : (
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Registered</th><th>Action</th></tr></thead>
                  <tbody>
                    {subscribers.map(s => (
                      <tr key={s.subscriber_id}>
                        <td>{s.subscriber_id}</td>
                        <td>{s.name}</td>
                        <td>{s.email}</td>
                        <td>{s.mobile || '—'}</td>
                        <td style={{ fontSize: 12 }}>{new Date(s.created_at).toLocaleString()}</td>
                        <td><button className="btn-sm btn-danger" onClick={() => handleDeleteSubscriber(s.subscriber_id)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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

          {/* COMMUNITY REPORTS TAB */}
          {activeTab === "community" && (
            <div className="table-container">
              <h2>🏞️ {t("communityReports")}</h2>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
                {t("communityReportsHint")}
              </p>
              <table>
                <thead>
                  <tr><th>ID</th><th>User</th><th>Source</th><th>Category</th><th>Description</th><th>Photo</th><th>{t("status")}</th><th>Time</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {communityReports.length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>{t("noData")}</td></tr>
                  )}
                  {communityReports.map((r) => (
                    <tr key={r.report_id}>
                      <td>{r.report_id}</td>
                      <td>{r.user_name}<div style={{ fontSize: 11, color: '#64748b' }}>{r.user_email}</div></td>
                      <td>{r.source_name || '-'}</td>
                      <td><strong>{r.category}</strong></td>
                      <td style={{ maxWidth: 220, fontSize: 12 }}>{r.description}</td>
                      <td>
                        {r.photo_url
                          ? <a href={`${API_URL}${r.photo_url}`} target="_blank" rel="noreferrer">
                              <img src={`${API_URL}${r.photo_url}`} alt="report" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                            </a>
                          : '-'}
                      </td>
                      <td><span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: r.status === 'Pending' ? '#fef3c7' : r.status === 'Resolved' ? '#d1fae5' : '#e2e8f0',
                        color: r.status === 'Pending' ? '#92400e' : r.status === 'Resolved' ? '#065f46' : '#334155'
                      }}>{r.status}</span></td>
                      <td style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {r.status !== 'Resolved' && (
                          <button className="btn-sm btn-success" onClick={() => handleUpdateReport(r.report_id, 'Resolved')}>{t("resolve")}</button>
                        )}
                        {r.status !== 'Dismissed' && (
                          <button className="btn-sm" onClick={() => handleUpdateReport(r.report_id, 'Dismissed')}>{t("dismiss")}</button>
                        )}
                      </td>
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

          {/* MAP TAB */}
          {activeTab === "map" && (
            <div>
              <h3 style={{ marginBottom: 16 }}>🗺️ Deployment Map — Nagaon Region</h3>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                Real monitoring station in Nagaon — click the source for Google Maps link
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
