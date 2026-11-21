import { useState, useEffect } from "react";
import API_URL from "./config";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { io } from "socket.io-client";
import WaterSourcesMap from "./WaterSourcesMap";

const socket = io(API_URL || undefined, { reconnection: process.env.NODE_ENV !== 'production' });

function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({ readings: 0, users: 0, sources: 0, uptime: "99.9" });
  const [liveStatus, setLiveStatus] = useState('connecting');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sensorRes, summaryRes] = await Promise.all([
          fetch(`${API_URL}/api/sensor-data?limit=24`).catch(() => null),
          fetch(`${API_URL}/api/summary`).catch(() => null),
        ]);
        if (sensorRes && sensorRes.ok) {
          const d = await sensorRes.json();
          if (d.data && d.data.length > 0) {
            setStats(s => ({ ...s, readings: d.data.length }));
          }
        }
        if (summaryRes && summaryRes.ok) {
          const s = await summaryRes.json();
          if (s.data) setStats(prev => ({ ...prev, users: s.data.totalUsers, sources: s.data.totalSources }));
        }
      } catch (e) { console.error(e); }
    };
    fetchAll();
    // Refetch periodically so the page stays fresh where WebSockets are
    // unavailable (e.g. Vercel serverless) — socket updates still win locally.
    const refetch = setInterval(fetchAll, 600000);

    setLiveStatus('connected');
    socket.on('connect', () => setLiveStatus('connected'));
    socket.on('disconnect', () => setLiveStatus('disconnected'));
    socket.on('sensor-update', (data) => {
      if (data) {
        setStats(prev => ({ ...prev, readings: prev.readings + 1 }));
      }
    });
    return () => { clearInterval(refetch); socket.off('sensor-update'); };
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

  const features = [
    { icon: "🌊", titleKey: "featRealtimeTitle", descKey: "featRealtimeDesc" },
    { icon: "📊", titleKey: "featAnalyticsTitle", descKey: "featAnalyticsDesc" },
    { icon: "🚨", titleKey: "featAlertsTitle", descKey: "featAlertsDesc" },
    { icon: "📱", titleKey: "featBilingualTitle", descKey: "featBilingualDesc" },
    { icon: "📋", titleKey: "featReportsTitle", descKey: "featReportsDesc" },
    { icon: "🔐", titleKey: "featAdminTitle", descKey: "featAdminDesc" }
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
            <a href="#features">{t("features")}</a>
            <a href="#map">{t("deployment")}</a>
            <a href="#station">{t("station")}</a>
            <a href="#alerts-register">{t("navAlerts")}</a>
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
            {liveStatus === 'connected' ? `● ${t('live')}` : `○ ${t('offline')}`} · v2.0 Industry Edition
          </div>
          <h1 className="hero-title">{t("heroTitleA")} <span className="gradient-text">{t("heroTitleB")}</span> {t("heroTitleC")}</h1>
          <p className="hero-subtitle">{t("heroSubtitle")}</p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg" onClick={() => navigate("/register")}>{t("getStarted")}</button>
            <button className="btn-outline btn-lg" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>{t("learnMore")}</button>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat"><span className="hero-stat-num">{stats.readings}+</span><span className="hero-stat-label">{t("statReadings")}</span></div>
            <div className="hero-stat"><span className="hero-stat-num">3</span><span className="hero-stat-label">{t("statParameters")}</span></div>
            <div className="hero-stat"><span className="hero-stat-num">24/7</span><span className="hero-stat-label">{t("statRealtime")}</span></div>
            <div className="hero-stat"><span className="hero-stat-num">WebSocket</span><span className="hero-stat-label">{t("statLiveUpdates")}</span></div>
          </div>
        </div>
      </section>

      <section id="features" className="section features-section">
        <div className="section-header" data-animate>
          <span className="section-tag">{t("features")}</span>
          <h2 className="section-title">{t("featuresTitle")}</h2>
          <p className="section-desc">{t("featuresDesc")}</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card" data-animate style={{ animationDelay: i * 0.1 + "s" }}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="map" className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="section-header" data-animate>
          <span className="section-tag">{t("deploymentTag")}</span>
          <h2 className="section-title">{t("mapTitle")}</h2>
          <p className="section-desc">{t("mapDesc")}</p>
        </div>
        <WaterSourcesMap t={t} i18n={i18n} />
      </section>

      {/* FIELD MONITORING STATION — real photo from the Nagaon installation */}
      <section id="station" className="section station-section">
        <div className="section-header" data-animate>
          <span className="section-tag">{t("stationTag")}</span>
          <h2 className="section-title">{t("stationTitle")}</h2>
          <p className="section-desc">{t("stationDesc")}</p>
        </div>
        <div className="station-grid" data-animate>
          <div className="station-photo-wrap">
            <img
              src="/station-photo.jpg"
              alt="EnviroSense field monitoring station at Nagaon, Maharashtra — sensor control cabinet beside the village well"
              className="station-photo"
              loading="lazy"
            />
            <div className="station-photo-badge">📷 GPS Map Camera · 31/10/2026 04:57 PM</div>
          </div>
          <div className="station-info glass-card">
            <h3>{t("stationDetails")}</h3>
            <div className="station-details">
              <div className="station-detail">
                <span className="station-detail-label">{t("lblLocation")}</span>
                <span className="station-detail-value">{t("stLocation")}</span>
              </div>
              <div className="station-detail">
                <span className="station-detail-label">{t("lblCoordinates")}</span>
                <span className="station-detail-value">{t("stCoordinates")}</span>
              </div>
              <div className="station-detail">
                <span className="station-detail-label">{t("lblParameters")}</span>
                <span className="station-detail-value">{t("ph")} · {t("tds")} · {t("turbidity")}</span>
              </div>
              <div className="station-detail">
                <span className="station-detail-label">{t("lblSampling")}</span>
                <span className="station-detail-value">{t("stSampling")}</span>
              </div>
              <div className="station-detail">
                <span className="station-detail-label">{t("lblHardware")}</span>
                <span className="station-detail-value">{t("stHardware")}</span>
              </div>
              <div className="station-detail">
                <span className="station-detail-label">{t("status")}</span>
                <span className="station-detail-value station-live">{t("stStatus")}</span>
              </div>
            </div>
            <a
              className="btn-primary station-map-btn"
              href="https://www.google.com/maps?q=16.924062,74.355358"
              target="_blank"
              rel="noreferrer"
            >
              {t("openMaps")}
            </a>
          </div>
        </div>
      </section>

      {/* CRITICAL ALERT NOTIFICATIONS — automatic for every registered user */}
      <section id="alerts-register" className="section alert-reg-section">
        <div className="section-header" data-animate>
          <span className="section-tag">{t("regAlertTag")}</span>
          <h2 className="section-title">{t("regAlertTitle")}</h2>
          <p className="section-desc">{t("regAlertDesc")}</p>
        </div>
        <div className="alert-reg-grid" data-animate>
          <div className="alert-reg-benefits glass-card">
            <div className="alert-reg-benefit"><span>🚨</span>{t("regBenefit1")}</div>
            <div className="alert-reg-benefit"><span>✅</span>{t("regBenefit2")}</div>
            <div className="alert-reg-benefit"><span>💧</span>{t("regBenefit3")}</div>
          </div>
          <div className="alert-reg-benefits glass-card">
            <div className="alert-reg-benefit"><span>📧</span>{t("regHowEmail")}</div>
            <div className="alert-reg-benefit"><span>📱</span>{t("regHowSms")}</div>
            <div className="alert-reg-benefit"><span>🔔</span>{t("regHowInApp")}</div>
          </div>
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="about-container" data-animate>
          <div className="about-content">
            <span className="section-tag">{t("about")}</span>
            <h2 className="section-title">{t("aboutTitle")}</h2>
            <p>{t("aboutP1a")}<strong>{t("aboutStationsCount")}</strong>{t("aboutP1b")}<strong>{t("aboutStationsList")}</strong>{t("aboutP1c")}</p>
            <p>{t("aboutP2")}</p>
            <p style={{ background: '#f0f9ff', padding: '12px 16px', borderRadius: 10, borderLeft: '3px solid #0ea5e9' }}>
              <strong>{t("currentDeployment")}</strong>{t("currentDeploymentDesc")}
            </p>
            <div className="about-stats">
              <div className="about-stat"><strong>3</strong> {t("statParameters")}</div>
              <div className="about-stat"><strong>24/7</strong> {t("continuous")}</div>
              <div className="about-stat"><strong>2</strong> {t("languages")}</div>
              <div className="about-stat"><strong>WebSocket</strong> {t("statRealtime")}</div>
            </div>
          </div>
          <div className="about-visual">
            <div className="about-card">
              <div className="about-card-header">{t("systemStatus")}</div>
              <div className="status-list">
                <div className="status-item"><span className="status-dot green"></span>{t("phSensor")} <span className="status-val">{t("active")}</span></div>
                <div className="status-item"><span className="status-dot green"></span>{t("tdsSensor")} <span className="status-val">{t("active")}</span></div>
                <div className="status-item"><span className="status-dot green"></span>{t("turbiditySensor")} <span className="status-val">{t("active")}</span></div>
                <div className="status-item"><span className="status-dot green"></span>{t("dataLogger")} <span className="status-val">{t("active")}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-banner">
        <div className="stats-banner-inner">
          <div className="stat-item"><span className="stat-number">24/7</span><span>{t("bannerRealtime")}</span></div>
          <div className="stat-item"><span className="stat-number">3</span><span>{t("bannerWaterParams")}</span></div>
          <div className="stat-item"><span className="stat-number">2</span><span>{t("bannerLanguages")}</span></div>
          <div className="stat-item"><span className="stat-number">IoT + WS</span><span>{t("bannerWs")}</span></div>
        </div>
      </section>

      <footer id="contact" className="landing-footer">
        <div className="footer-container">
          <div className="footer-col">
            <h3>🌊 EnviroSense v2.0</h3>
            <p>{t("footerDesc")}</p>
          </div>
          <div className="footer-col">
            <h4>{t("quickLinks")}</h4>
            <button className="footer-link" onClick={() => navigate("/register")}>{t("register")}</button>
            <button className="footer-link" onClick={() => navigate("/login")}>{t("login")}</button>
            <button className="footer-link" onClick={() => navigate("/adminLogin")}>{t("adminPanel")}</button>
          </div>
          <div className="footer-col">
            <h4>{t("contact")}</h4>
            <p>{t("project")}</p>
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
