import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import { io } from "socket.io-client";
import WaterSourcesMap from "./WaterSourcesMap";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const socket = io("http://localhost:5000");

function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({ readings: 0, users: 0, sources: 0, uptime: "99.9" });
  const [chartData, setChartData] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [liveStatus, setLiveStatus] = useState('connecting');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sensorRes, summaryRes] = await Promise.all([
          fetch("http://localhost:5000/api/sensor-data?limit=24").catch(() => null),
          fetch("http://localhost:5000/api/summary").catch(() => null),
        ]);
        if (sensorRes && sensorRes.ok) {
          const d = await sensorRes.json();
          if (d.data && d.data.length > 0) {
            setStats(s => ({ ...s, readings: d.data.length }));
            setLatestReading(d.data[0]);
            const reversed = [...d.data].reverse();
            setChartData({
              labels: reversed.map(r => new Date(r.recorded_at).toLocaleTimeString()),
              datasets: [
                { label: "pH", data: reversed.map(r => r.ph), borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,0.1)", fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 6 },
                { label: "TDS", data: reversed.map(r => r.tds), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.1)", fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 6, yAxisID: "y1" }
              ]
            });
          }
        }
        if (summaryRes && summaryRes.ok) {
          const s = await summaryRes.json();
          if (s.data) setStats(prev => ({ ...prev, users: s.data.totalUsers, sources: s.data.totalSources }));
        }
      } catch (e) { console.error(e); }
    };
    fetchAll();

    setLiveStatus('connected');
    socket.on('connect', () => setLiveStatus('connected'));
    socket.on('disconnect', () => setLiveStatus('disconnected'));
    socket.on('sensor-update', (data) => {
      if (data) {
        setLatestReading(data);
        setStats(prev => ({ ...prev, readings: prev.readings + 1 }));
        setChartData(prev => {
          if (!prev) return prev;
          const labels = [...prev.labels.slice(1), new Date(data.recorded_at).toLocaleTimeString()];
          const phData = [...prev.datasets[0].data.slice(1), data.ph];
          const tdsData = [...prev.datasets[1].data.slice(1), data.tds];
          return { ...prev, labels, datasets: [ { ...prev.datasets[0], data: phData }, { ...prev.datasets[1], data: tdsData } ] };
        });
      }
    });
    return () => { socket.off('sensor-update'); };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        entry.target.style.opacity = entry.isIntersecting ? 1 : 0.5;
        entry.target.style.transform = entry.isIntersecting ? 'translateY(0)' : 'translateY(20px)';
      });
    }, { threshold: 0.1 });
    document.querySelectorAll("[data-animate]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "en" ? "mr" : "en");
  };

  const getStatusColor = () => {
    if (!latestReading) return '#64748b';
    const ph = latestReading.ph;
    if (ph >= 6.5 && ph <= 8.5) return '#10b981';
    return '#ef4444';
  };

  const features = [
    { icon: "🌊", title: "Real-Time Monitoring", desc: "Monitor river water quality in real-time with high-precision IoT sensors deployed across Nagaon river basin." },
    { icon: "📊", title: "Smart Analytics", desc: "Advanced analytics and visualization tools to track water quality trends, compare historical data, and predict issues." },
    { icon: "🚨", title: "Instant Alerts", desc: "Get immediate notifications via the app when water quality parameters exceed safe thresholds for quick response." },
    { icon: "📱", title: "Marathi + English", desc: "Full bilingual support with Marathi and English language options for access across the entire community." },
    { icon: "📋", title: "Auto Reports", desc: "Generate detailed PDF & CSV reports with per-parameter safety analysis for regulatory compliance." },
    { icon: "🔐", title: "Secure Admin Panel", desc: "Role-based access control with comprehensive admin dashboard for user management and system configuration." }
  ];

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="nav-logo-icon">🌊</span>
            <span className="nav-logo-text">EnviroSense</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#map">Deployment</a>
            <a href="#about">{t("about")}</a>
          </div>
          <div className="nav-actions">
            <button className="btn-lang" onClick={toggleLang}>{i18n.language === "en" ? "मराठी" : "English"}</button>
            <button className="btn-outline" onClick={() => navigate("/login-choice")}>{t("login")}</button>
            <button className="btn-primary nav-register" onClick={() => navigate("/register")}>{t("register")}</button>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg">
          <div className="wave wave-1"></div><div className="wave wave-2"></div><div className="wave wave-3"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            {liveStatus === 'connected' ? '● LIVE' : '○ OFFLINE'} · v2.0 Industry Edition
          </div>
          <h1 className="hero-title">Real-Time <span className="gradient-text">Water Quality</span> Monitoring</h1>
          <p className="hero-subtitle">Advanced IoT-powered system monitoring the health of Nagaon rivers and water sources with instant alerts, smart analytics, WebSocket real-time updates, and community-driven insights.</p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg" onClick={() => navigate("/register")}>Get Started Free</button>
            <button className="btn-outline btn-lg" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>Learn More</button>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat"><span className="hero-stat-num">{stats.readings}+</span><span className="hero-stat-label">Readings</span></div>
            <div className="hero-stat"><span className="hero-stat-num">6</span><span className="hero-stat-label">Parameters</span></div>
            <div className="hero-stat"><span className="hero-stat-num">24/7</span><span className="hero-stat-label">Real-time</span></div>
            <div className="hero-stat"><span className="hero-stat-num">WebSocket</span><span className="hero-stat-label">Live Updates</span></div>
          </div>
        </div>
      </section>

      <section id="features" className="section features-section">
        <div className="section-header" data-animate>
          <span className="section-tag">Features</span>
          <h2 className="section-title">Industry-Grade Water Monitoring Platform</h2>
          <p className="section-desc">Comprehensive tools designed for environmental agencies, researchers, communities, and village panchayats.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card" data-animate style={{ animationDelay: i * 0.1 + "s" }}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="map" className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="section-header" data-animate>
          <span className="section-tag">Deployment Map</span>
          <h2 className="section-title">📍 Sensor Network — Nagaon Region</h2>
          <p className="section-desc">Real monitoring stations deployed across Nagaon, Ashta, Nagav, and Khanapur villages with live Google Maps integration</p>
        </div>
        <WaterSourcesMap t={t} i18n={i18n} />
      </section>

      {chartData && (
        <section className="section chart-preview-section">
          <div className="section-header" data-animate>
            <span className="section-tag">Live Data Stream</span>
            <h2 className="section-title">Real-Time Sensor Trends</h2>
            <p className="section-desc">Data updates automatically via WebSocket every 10 minutes</p>
          </div>
          <div className="chart-card" data-animate>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getStatusColor(), display: 'inline-block' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0c4a6e' }}>
                  pH: {latestReading?.ph || '-'} · TDS: {latestReading?.tds || '-'}
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {latestReading ? new Date(latestReading.recorded_at).toLocaleString() : ''}
              </span>
            </div>
            <Line data={chartData} options={{
              responsive: true, animation: { duration: 500 },
              interaction: { mode: "index", intersect: false },
              plugins: { legend: { position: "top", labels: { usePointStyle: true, padding: 20 } } },
              scales: {
                y: { beginAtZero: false, title: { display: true, text: "pH Level" }, grid: { color: "rgba(0,0,0,0.05)" } },
                y1: { position: "right", beginAtZero: false, title: { display: true, text: "TDS (ppm)" }, grid: { display: false } }
              }
            }} />
          </div>
        </section>
      )}

      <section id="about" className="section about-section">
        <div className="about-container" data-animate>
          <div className="about-content">
            <span className="section-tag">About</span>
            <h2 className="section-title">Smart Water for Smart Communities</h2>
            <p>EnviroSense is a cutting-edge water quality monitoring system deployed across the Nagaon river basin. Our IoT sensor network covers <strong>7 monitoring stations</strong> including wells, rivers, lakes, and borewells across <strong>Nagaon, Ashta, Nagav, and Khanapur</strong> villages.</p>
            <p>Each station continuously measures 6 critical water parameters — pH, TDS, turbidity, dissolved oxygen, temperature, and water level. Real-time data is analyzed against WHO safety standards, and instant alerts are sent to authorities when parameters exceed safe thresholds.</p>
            <p style={{ background: '#f0f9ff', padding: '12px 16px', borderRadius: 10, borderLeft: '3px solid #0ea5e9' }}>
              <strong>📍 Current Deployment:</strong> Ashta Hostel Well is being actively tested with real water samples.
            </p>
            <div className="about-stats">
              <div className="about-stat"><strong>6+</strong> Parameters</div>
              <div className="about-stat"><strong>24/7</strong> Continuous</div>
              <div className="about-stat"><strong>2</strong> Languages</div>
              <div className="about-stat"><strong>WebSocket</strong> Real-time</div>
            </div>
          </div>
          <div className="about-visual">
            <div className="about-card">
              <div className="about-card-header">System Status</div>
              <div className="status-list">
                <div className="status-item"><span className="status-dot green"></span>pH Sensor <span className="status-val">Active</span></div>
                <div className="status-item"><span className="status-dot green"></span>TDS Sensor <span className="status-val">Active</span></div>
                <div className="status-item"><span className="status-dot green"></span>Turbidity Sensor <span className="status-val">Active</span></div>
                <div className="status-item"><span className="status-dot green"></span>DO Sensor <span className="status-val">Active</span></div>
                <div className="status-item"><span className="status-dot green"></span>Temperature <span className="status-val">Active</span></div>
                <div className="status-item"><span className="status-dot green"></span>Water Level <span className="status-val">Active</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-banner">
        <div className="stats-banner-inner">
          <div className="stat-item"><span className="stat-number">24/7</span><span>Real-time Monitoring</span></div>
          <div className="stat-item"><span className="stat-number">6</span><span>Water Parameters</span></div>
          <div className="stat-item"><span className="stat-number">2</span><span>Languages (EN/MR)</span></div>
          <div className="stat-item"><span className="stat-number">IoT + WS</span><span>WebSocket Live</span></div>
        </div>
      </section>

      <footer id="contact" className="landing-footer">
        <div className="footer-container">
          <div className="footer-col">
            <h3>🌊 EnviroSense v2.0</h3>
            <p>Industry-grade river water quality monitoring for the Nagaon community. Real-time data, instant alerts, comprehensive analytics, and community engagement.</p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <button className="footer-link" onClick={() => navigate("/register")}>Register</button>
            <button className="footer-link" onClick={() => navigate("/login")}>Login</button>
            <button className="footer-link" onClick={() => navigate("/adminLogin")}>Admin</button>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <p>Nagaon River Project</p>
            <p>info@envirosense.in</p>
          </div>
          <div className="footer-col">
            <h4>Language</h4>
            <button className="btn-lang footer-lang" onClick={toggleLang}>{i18n.language === "en" ? "मराठी" : "English"}</button>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} EnviroSense v2.0 - Nagaon River Water Quality Monitoring System | Powered by WebSocket Real-Time Engine</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
