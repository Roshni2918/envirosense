import React, { useState, useEffect, useRef } from "react";
import API_URL from "./config";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { io } from "socket.io-client";
import jsPDF from "jspdf";
import SuggestionForm from "./SuggestionForm";
import NotificationBell from "./NotificationBell";
import EmergencyAlert from "./EmergencyAlert";
import WaterCalendar from "./WaterCalendar";
import ProfileSettings from "./ProfileSettings";
import WaterSourcesMap from "./WaterSourcesMap";
import ForecastCard from "./ForecastCard";
import ReportIssue from "./ReportIssue";
import usePushNotifications from "./usePushNotifications";
import "./App.css";

const socket = io(API_URL || undefined, { reconnection: process.env.NODE_ENV !== 'production' });

const Dashboard = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [latestData, setLatestData] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState("dashboard");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading] = useState(true);

  const [lastUpdate, setLastUpdate] = useState(null);
  const [liveStatus, setLiveStatus] = useState('connecting');

  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [toasts, setToasts] = useState([]);
  const [countdown, setCountdown] = useState(600);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [prevData, setPrevData] = useState(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const { pushSupported, permissionState, subscribed, requestPermission, unsubscribe } = usePushNotifications(token);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'mr' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  const showToast = (type, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const manualRefresh = () => {
    Promise.all([fetchLatestData(), fetchSensorHistory(), fetchAlerts()]);
    showToast('info', '⟳ Data refreshed');
    setCountdown(600);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login-choice");
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

  const getParamStatus = (paramName, value) => {
    const ranges = { ph: { min: 6.5, max: 8.5 }, tds: { min: 50, max: 300 }, turbidity: { min: 0, max: 5 } };
    const range = ranges[paramName];
    if (!range) return 'safe';
    return (value < range.min || value > range.max) ? 'unsafe' : 'safe';
  };

  // Overall status for one reading: safe / unsafe / critical
  // (critical uses the same severity rule as the backend alert engine)
  const getRowStatus = (row) => {
    const ranges = { ph: { min: 6.5, max: 8.5 }, tds: { min: 50, max: 300 }, turbidity: { min: 0, max: 5 } };
    let critical = false;
    let unsafe = false;
    for (const key of Object.keys(ranges)) {
      const range = ranges[key];
      const value = Number(row[key]);
      if (value === undefined || value === null || isNaN(value)) continue;
      if (value < range.min * 0.4 || value > range.max * 1.6) critical = true;
      else if (value < range.min || value > range.max) unsafe = true;
    }
    return critical ? 'critical' : unsafe ? 'unsafe' : 'safe';
  };

  const rowStatusBadge = (row) => {
    const status = getRowStatus(row);
    const label = status === 'critical' ? '🚨 Critical' : status === 'unsafe' ? '⚠️ Unsafe' : '✅ Safe';
    const color = status === 'critical' ? '#dc2626' : status === 'unsafe' ? '#b45309' : '#10b981';
    const bg = status === 'critical' ? '#fef2f2' : status === 'unsafe' ? '#fffbeb' : '#ecfdf5';
    return (
      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    );
  };

  const fetchLatestData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sensor-data/latest`);
      const data = await res.json();
      if (data.data) { setLatestData(data.data); setLastUpdate(new Date()); }
    } catch (e) { console.error(e); }
  };

  const fetchSensorHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sensor-data?limit=24`);
      const data = await res.json();
      if (data.data) {
        setSensorHistory(data.data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts/unresolved`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setAlerts(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchSystemHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/system-health`);
      const data = await res.json();
      if (data.data) setSystemHealth(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    if (!historyStart || !historyEnd) return alert("Please select start and end dates");
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/user/data?start_date=${historyStart}&end_date=${historyEnd}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistoryData(data.data || []);
    } catch { alert("Failed to fetch data"); }
    setHistoryLoading(false);
  };

  const downloadHistoryPDF = () => {
    if (historyData.length === 0) return alert("No data to download");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18); doc.text("Water Quality History Report", 20, 20);
    doc.setFontSize(10); doc.text(`Period: ${historyStart} to ${historyEnd}`, 20, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 37);
    doc.text(`User: ${user.name || "N/A"}`, 20, 44);
    let y = 55; doc.setFontSize(8);
    const headers = ["Date & Time", "pH", "Status", "TDS", "Status", "Turbidity", "Status"];
    const cols = [20, 55, 75, 95, 115, 135, 160];
    headers.forEach((h, i) => doc.text(h, cols[i], y));
    y += 6;
    historyData.forEach((row) => {
      const isSafe = (param, val) => getParamStatus(param, val) === 'safe';
      doc.text(new Date(row.recorded_at).toLocaleString(), cols[0], y);
      doc.text(String(row.ph || "-"), cols[1], y); doc.text(isSafe('ph', row.ph) ? "Safe" : "Unsafe", cols[2], y);
      doc.text(String(row.tds || "-"), cols[3], y); doc.text(isSafe('tds', row.tds) ? "Safe" : "Unsafe", cols[4], y);
      doc.text(String(row.turbidity || "-"), cols[5], y); doc.text(isSafe('turbidity', row.turbidity) ? "Safe" : "Unsafe", cols[6], y);
      y += 6;
      if (y > 190) { doc.addPage(); y = 20; }
    });
    doc.save(`water-history-${historyStart}-${historyEnd}.pdf`);
  };

  const downloadCSV = async () => {
    try {
      const params = (historyStart && historyEnd) ? `?start_date=${historyStart}&end_date=${historyEnd}` : '';
      const res = await fetch(`${API_URL}/api/csv-export${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `water-quality-${historyStart || 'all'}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert("Failed to download CSV"); }
  };

  const downloadFile = async (path, extension) => {
    try {
      const params = (historyStart && historyEnd) ? `?start_date=${historyStart}&end_date=${historyEnd}` : '';
      const res = await fetch(`${API_URL}${path}${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `water-quality-${historyStart || 'all'}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', `✅ ${extension.toUpperCase()} downloaded`);
    } catch {
      alert(`Failed to download ${extension.toUpperCase()}`);
    }
  };

  const downloadXLSX = () => downloadFile('/api/export/xlsx', 'xlsx');
  const downloadJSON = () => downloadFile('/api/export/json', 'json');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLatestData(), fetchSensorHistory(), fetchAlerts(), fetchSystemHealth()]);
      setLoading(false);
    };
    loadData();
    const interval = setInterval(loadData, 600000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLiveStatus('connected');
    socket.on('connect', () => setLiveStatus('connected'));
    socket.on('disconnect', () => setLiveStatus('disconnected'));
    socket.on('sensor-update', (data) => {
      if (data) {
        setPrevData(latestData);
        setLatestData(data);
        setLastUpdate(new Date());
        setCountdown(600);
      }
    });
    socket.on('new-alert', (alert) => {
      if (alert) {
        setAlerts(prev => [alert, ...prev].slice(0, 50));
        showToast('warning', `⚠️ ${alert.parameter_name} alert triggered`);
      }
    });
    return () => { socket.off('sensor-update'); socket.off('new-alert'); };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { manualRefresh(); return 600; } return prev - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getTrend = (key) => {
    if (!prevData || !latestData) return 'stable';
    const curr = parseFloat(latestData[key]);
    const prev = parseFloat(prevData[key]);
    if (isNaN(curr) || isNaN(prev)) return 'stable';
    const diff = curr - prev;
    if (Math.abs(diff) < 0.01) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const generateInsights = (params) => {
    const insights = [];
    params.forEach(p => {
      if (p.status === 'safe') {
        if (getTrend(p.key) === 'up') insights.push({ type: 'good', icon: '✅', text: `${p.name} is stable and within safe range.` });
        else if (getTrend(p.key) === 'down') insights.push({ type: 'good', icon: '📉', text: `${p.name} is decreasing — favorable trend.` });
        else insights.push({ type: 'good', icon: '✅', text: `${p.name} is within safe limits.` });
      } else {
        if (getTrend(p.key) === 'up') insights.push({ type: 'danger', icon: '🚨', text: `${p.name} is ${p.value} — above safe range! Action needed.` });
        else insights.push({ type: 'warning', icon: '⚠️', text: `${p.name} is ${p.value} — outside safe range. Monitor closely.` });
      }
    });
    if (params.every(p => p.status === 'safe')) {
      insights.unshift({ type: 'good', icon: '💧', text: 'All parameters normal. Water quality is good for use.' });
    }
    return insights.slice(0, 4);
  };

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

  const menuItems = [
    { key: "dashboard", icon: "📊", label: t("dashboard") },
    { key: "history", icon: "📋", label: t("readingHistory") },
    { key: "calendar", icon: "📅", label: t("waterCalendar") },
    { key: "health", icon: "🔋", label: t("systemHealth") },
    { key: "map", icon: "🗺️", label: "Deployment Map" }
  ];

  if (loading) {
    return <div className="dashboard-container"><div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><h2 style={{ color: '#94a3b8' }}>{t("loading")}</h2></div></div>;
  }

  return (
    <div className="dashboard-container">
      <EmergencyAlert alerts={alerts} t={t} i18n={i18n} />

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>

      <div className="sidebar glass-sidebar">
        <div className="sidebar-header">
          <span style={{ fontSize: 32, display: 'block' }}>🌊</span>
          <h3>EnviroSense</h3>
          <p style={{ fontSize: 11, color: "#64748b" }}>{user.name || "User"}</p>
          <span style={{
            display: 'inline-block', fontSize: 9, padding: '2px 8px', borderRadius: 8,
            background: liveStatus === 'connected' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: liveStatus === 'connected' ? '#10b981' : '#ef4444',
            fontWeight: 600, marginTop: 4
          }}>
            {liveStatus === 'connected' ? `● ${t("live")}` : '○ Offline'}
          </span>
        </div>
        <ul>
          {menuItems.map(item => (
            <li key={item.key} className={activePanel === item.key ? "active" : ""} onClick={() => setActivePanel(item.key)}>
              <span>{item.icon}</span> <span>{item.label}</span>
            </li>
          ))}
          <li onClick={() => setShowSuggestion(true)}><span>💬</span> <span>Suggestions</span></li>
          <li onClick={() => setShowReport(true)}><span>🏞</span> <span>{t("reportIssue")}</span></li>
          <li onClick={() => setShowProfile(true)}><span>⚙️</span> <span>{t("profileSettings")}</span></li>
          <li onClick={() => navigate("/")}><span>🏠</span> <span>{t("home")}</span></li>
        </ul>
        <div className="sidebar-footer">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={toggleTheme} className="theme-toggle" title={darkMode ? 'Light Mode' : 'Dark Mode'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={toggleLanguage} className="lang-toggle" style={{ flex: 1 }}>{i18n.language === 'en' ? 'मराठी' : 'English'}</button>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="top-bar glass-topbar">
          <div>
            <h1 style={{ fontSize: 20 }}>
              {activePanel === "dashboard" ? `🌊 ${t("waterQualityDashboard")}` :
               activePanel === "history" ? `📋 ${t("readingHistory")}` :
               activePanel === "calendar" ? `📅 ${t("waterCalendar")}` :
               activePanel === "health" ? `🔋 ${t("systemHealth")}` :
               activePanel === "map" ? "🗺️ Deployment Map" : 'EnviroSense'}
            </h1>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: '#64748b' }}>
                ● {t("live")} · {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)} {t("seconds")} {t("ago")}
              </span>
            )}
          </div>
          <div className="top-bar-right">
            <div className="countdown-ring" title={autoRefresh ? `Auto-refresh in ${countdown}s` : 'Auto-refresh off'}>
              <svg width="36" height="36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(14,165,233,0.15)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#0ea5e9" strokeWidth="3"
                  strokeDasharray={`${(countdown / 600) * 94.2} 94.2`} strokeLinecap="round" />
              </svg>
              <span style={{ position: 'absolute', fontSize: 10, fontWeight: 700, color: '#0ea5e9' }}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </span>
            </div>
            <button onClick={() => { setAutoRefresh(!autoRefresh); showToast('info', autoRefresh ? '⏸ Auto-refresh paused' : '▶️ Auto-refresh resumed'); }}
              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: autoRefresh ? '#10b981' : '#94a3b8' }}
              title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}>
              {autoRefresh ? '🔁' : '⏸️'}
            </button>
            <NotificationBell socket={socket} token={token} t={t} i18n={i18n} />
            {activePanel === "dashboard" && alerts.length > 0 && <span className="badge-alert pulse">{alerts.length}</span>}
            {pushSupported && (
              <button onClick={subscribed ? unsubscribe : requestPermission}
                style={{
                  background: subscribed ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                  border: subscribed ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                  color: subscribed ? '#10b981' : '#94a3b8', fontSize: 16,
                  transition: 'all 0.2s'
                }}
                title={subscribed ? 'Push notifications ON (click to disable)' : 'Enable push notifications'}>
                {subscribed ? '🔔' : '🔕'}
              </button>
            )}
            <button onClick={manualRefresh} className="btn-glass" style={{ padding: '8px 12px', fontSize: 13 }}>⟳</button>
            <button className="btn-logout" onClick={handleLogout}>{t("logout")}</button>
          </div>
        </div>

        {/* HISTORY PANEL */}
        {activePanel === "history" && (
          <div className="history-panel">
            <div className="history-search glass-card">
              <div className="history-fields">
                <div><label>{t("dateTime")} (Start)</label><input type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} /></div>
                <div><label>{t("dateTime")} (End)</label><input type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} /></div>
                <button className="btn-primary" onClick={fetchHistory} disabled={historyLoading}>{historyLoading ? t("loading") : `🔍 ${t("search")}`}</button>
                {historyData.length > 0 && (
                  <>
                    <button className="btn-glass" onClick={downloadHistoryPDF}>📥 PDF</button>
                    <button className="btn-glass" onClick={downloadCSV}>📊 CSV</button>
                    <button className="btn-glass" onClick={downloadXLSX}>📗 Excel</button>
                    <button className="btn-glass" onClick={downloadJSON}>🧾 JSON</button>
                  </>
                )}
              </div>
            </div>
            {historyData.length > 0 ? (
              <div className="table-container glass-card">
                <h2>📊 {historyData.length} readings ({historyStart} → {historyEnd})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th><th>pH</th><th>Status</th><th>TDS</th><th>Status</th>
                      <th>Turbidity</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((row, i) => (
                      <tr key={i}>
                        <td>{new Date(row.recorded_at).toLocaleString()}</td>
                        <td>{row.ph}</td>
                        <td style={{ color: getParamStatus('ph', row.ph) === 'safe' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                          {getParamStatus('ph', row.ph) === 'safe' ? '✅' : '⚠️'}
                        </td>
                        <td>{row.tds}</td>
                        <td style={{ color: getParamStatus('tds', row.tds) === 'safe' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                          {getParamStatus('tds', row.tds) === 'safe' ? '✅' : '⚠️'}
                        </td>
                        <td>{row.turbidity}</td>
                        <td style={{ color: getParamStatus('turbidity', row.turbidity) === 'safe' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                          {getParamStatus('turbidity', row.turbidity) === 'safe' ? '✅' : '⚠️'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="history-empty glass-card">
                <span style={{ fontSize: 48 }}>📋</span>
                <h3>{t("readingHistory")}</h3>
                <p style={{ color: "#64748b" }}>{t("noData")}</p>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR */}
        {activePanel === "calendar" && (
          <WaterCalendar t={t} i18n={i18n} token={token} />
        )}

        {/* SYSTEM HEALTH */}
        {activePanel === "health" && (
          <div className="glass-card" style={{ padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0c4a6e' }}>🔋 {t("systemHealth")}</h3>
            <div className="stats-cards" style={{ marginBottom: 20 }}>
              {[
                { icon: '📊', label: t("todayReadings"), value: systemHealth?.totalReadings || '-', color: '#0ea5e9' },
                { icon: '🚨', label: t("activeAlerts"), value: systemHealth?.activeAlerts || '0', color: systemHealth?.activeAlerts > 0 ? '#ef4444' : '#10b981' },
                { icon: '👤', label: t("totalUsers"), value: systemHealth?.activeUsers || '-', color: '#8b5cf6' },
                { icon: '⏱️', label: t("systemUptime"), value: `${systemHealth?.minutesSinceLastReading || 0}m`, color: '#f59e0b' },
              ].map((stat, i) => (
                <div key={i} className="stat-card" style={{ borderLeft: `3px solid ${stat.color}` }}>
                  <div className="stat-card-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
                    <span>{stat.icon}</span>
                  </div>
                  <div className="stat-card-info">
                    <h4>{stat.value}</h4>
                    <p>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: t("systemStatus"), value: systemHealth?.status || t("loading"), color: systemHealth?.status === 'healthy' ? '#10b981' : systemHealth?.status === 'degraded' ? '#f59e0b' : '#ef4444' },
                { label: t("sensorHealth"), value: `${systemHealth?.activeSensors || 0} ${t("connectedDevices")}`, color: '#0ea5e9' },
                { label: t("lastReading"), value: systemHealth?.lastReading ? Math.floor((Date.now() - new Date(systemHealth.lastReading).getTime()) / 60000) + 'm ago' : '-', color: '#8b5cf6' },
                { label: t("last24h"), value: `${systemHealth?.lastHourReadings || 0} readings/hr`, color: '#10b981' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: '16px 20px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(14,165,233,0.05)', borderRadius: 12, border: '1px solid rgba(14,165,233,0.15)' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                🌐 <strong>{t("sensorSimulation")}:</strong> {t("seasonalPattern")} ({t("monsoon")}) · {t("live")} WebSocket
              </div>
            </div>
          </div>
        )}

        {/* DEPLOYMENT MAP */}
        {activePanel === "map" && (
          <div className="glass-card" style={{ padding: 28 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#0c4a6e' }}>🗺️ Deployment Map</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              Real monitoring stations across Nagaon region — Google Maps integration with live location data
            </p>
            <WaterSourcesMap t={t} i18n={i18n} />
          </div>
        )}

        {/* MAIN DASHBOARD */}
        {activePanel === "dashboard" && (
          <>
            {alerts.length > 0 && (
              <div className="alert-banner pulse-border" style={{
                background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px',
                marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 24, animation: 'pulse 2s infinite' }}>🚨</span>
                <div>
                  <strong style={{ color: '#991b1b' }}>{t("waterQualityAlert")}:</strong>
                  {alerts.slice(0, 2).map((alert, i) => (
                    <span key={i} style={{ color: '#7f1d1d', fontSize: 13, marginLeft: i > 0 ? 12 : 8 }}>
                      {i18n.language === 'en' ? alert.alert_message_en : alert.alert_message_mr}
                    </span>
                  ))}
                  {alerts.length > 2 && <span style={{ color: '#7f1d1d', fontSize: 13, marginLeft: 8 }}>+{alerts.length - 2} more</span>}
                </div>
              </div>
            )}

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
                <h3>{t("waterQualityDashboard")}</h3>
                <p>{t("overallStatus")}</p>
                <span className={`status-badge ${wqiClass}`}>{wqiLabel}</span>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{t("lastReading")}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0c4a6e' }}>
                  {latestData ? new Date(latestData.recorded_at).toLocaleString() : 'N/A'}
                </div>
                {latestData && (
                  <span style={{ fontSize: 11, color: '#10b981' }}>
                    ● {Math.floor((Date.now() - new Date(latestData.recorded_at).getTime()) / 60000)}m {t("ago")}
                  </span>
                )}
              </div>
            </div>

            <div className="parameters">
              {parameters.map((param, index) => {
                const trend = getTrend(param.key);
                const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
                const trendClass = trend === 'up' && param.status === 'unsafe' ? 'trend-up' :
                  trend === 'down' && param.status === 'unsafe' ? 'trend-down' :
                  trend === 'up' ? 'trend-down' : trend === 'down' ? 'trend-up' : 'trend-stable';
                return (
                <div className={`param-box glass-card`} key={index}
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
                  <div className={trendClass} style={{ fontSize: 12, marginTop: 4 }}>
                    {trendIcon} {trend === 'up' ? (param.status === 'safe' ? 'Improving' : 'Rising') : trend === 'down' ? (param.status === 'safe' ? 'Stable' : 'Falling') : 'Stable'}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="water-status glass-card" style={{
              background: overallSafe
                ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
              borderColor: overallSafe ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
            }}>
              <h2 style={{ fontSize: 16 }}>💧 {t("waterQualityAlert")}</h2>
              <div className={`status-display ${overallSafe ? 'safe' : 'unsafe'}`}
                style={{ fontSize: 24 }}>
                {overallSafe ? '✅ ' + t("safe") : '⚠️ ' + t("unsafe")}
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                {overallSafe
                  ? 'All water quality parameters are within safe ranges.'
                  : 'Some parameters exceed safe thresholds. Check alerts above.'}
              </p>
            </div>

            {parameters.length > 0 && (
              <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, color: '#0c4a6e', marginBottom: 12 }}>💡 Smart Insights</h3>
                {generateInsights(parameters).map((insight, i) => (
                  <div key={i} className={`insight-card ${insight.type}`}>
                    <span style={{ fontSize: 18 }}>{insight.icon}</span>
                    <span style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{insight.text}</span>
                  </div>
                ))}
              </div>
            )}

            <ForecastCard readings={sensorHistory} t={t} />

            <div className="chart-card glass-card" style={{ marginBottom: 24 }}>
              <h3>🚨 {t("viewAlerts")}</h3>
              <div className="alert-feed">
                {alerts.length > 0 ? alerts.slice(0, 5).map((alert, i) => (
                  <div key={i} className={`alert-item ${alert.alert_message_en?.includes('🚨') ? 'critical' : 'high'}`}>
                    <span className="alert-icon">⚠️</span>
                    <div className="alert-text">
                      <strong>{alert.parameter_name}</strong>
                      <span>{i18n.language === 'en' ? alert.alert_message_en : alert.alert_message_mr}</span>
                    </div>
                  </div>
                )) : (
                  <div className="no-alerts">✅ No active alerts. Water quality is normal.</div>
                )}
              </div>
            </div>

            <div className="table-container glass-card">
              <h2>📋 {t("sensorName")} {t("history") || 'History'}</h2>
              <table>
                <thead>
                  <tr><th>{t("dateTime")}</th><th>{t("ph")}</th><th>{t("tds")}</th><th>{t("turbidity")}</th><th>{t("status")}</th></tr>
                </thead>
                <tbody>
                  {sensorHistory.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td>{new Date(row.recorded_at).toLocaleString()}</td>
                      <td>{row.ph}</td><td>{row.tds}</td><td>{row.turbidity}</td>
                      <td>{rowStatusBadge(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

            {showSuggestion && <SuggestionForm onClose={() => setShowSuggestion(false)} />}
            {showReport && <ReportIssue onClose={() => setShowReport(false)} />}
            {showProfile && <ProfileSettings t={t} token={token} user={user} onClose={() => setShowProfile(false)} onUpdate={() => {}} />}
    </div>
  );
};

export default Dashboard;
