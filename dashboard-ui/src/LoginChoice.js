import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./App.css";

function LoginChoice() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(); // eslint-disable-line no-unused-vars

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "en" ? "mr" : "en");
  };

  return (
    <div className="auth-container" style={{ flexDirection: "column", gap: 40 }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 48 }}>🌊</span>
        <h1 style={{ color: "#fff", fontSize: 28, marginTop: 12 }}>EnviroSense</h1>
        <p style={{ color: "#94a3b8", fontSize: 15 }}>Nagaon River Water Quality Monitoring</p>
      </div>

      <div className="login-choice-cards">
        <div className="choice-card" onClick={() => navigate("/login")}>
          <div className="choice-icon">👤</div>
          <h3>{t("registerTitle") || "User"}</h3>
          <p>Access your personal dashboard to view water quality data, download history, and submit suggestions.</p>
          <span className="choice-btn">{t("login")}</span>
        </div>

        <div className="choice-card admin-card" onClick={() => navigate("/adminLogin")}>
          <div className="choice-icon">🔐</div>
          <h3>Admin</h3>
          <p>Manage users, monitor all system data, configure settings, and handle user queries.</p>
          <span className="choice-btn admin-btn">Admin Login</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button className="btn-lang" onClick={toggleLang} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>
          {i18n.language === "en" ? "मराठी" : "English"}
        </button>
        <button className="btn-outline" onClick={() => navigate("/")} style={{ color: "#94a3b8" }}>
          🏠 {t("home")}
        </button>
      </div>
    </div>
  );
}

export default LoginChoice;
