import React, { useEffect, useState } from "react";

const EmergencyAlert = ({ alerts, t, i18n }) => {
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const critical = alerts.filter(a =>
      a.alert_message_en?.includes('🚨') || a.alert_message_mr?.includes('🚨')
    );
    if (critical.length > 0 && critical.length !== urgentAlerts.length) {
      setUrgentAlerts(critical);
      setShowAlert(true);
      const timer = setTimeout(() => setShowAlert(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [alerts.length]);

  if (!showAlert || urgentAlerts.length === 0) return null;

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 9998,
        animation: 'fadeIn 0.3s ease'
      }} onClick={() => setShowAlert(false)} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999, width: '90%', maxWidth: 480,
        background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
        borderRadius: 20, padding: 32, color: '#fff',
        boxShadow: '0 0 60px rgba(239,68,68,0.4), 0 0 120px rgba(239,68,68,0.2)',
        animation: 'slideUp 0.4s ease'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 64, display: 'block', marginBottom: 8 }}>🚨</span>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            {t("emergencyAlert")}
          </h2>
          <p style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
            {t("waterQualityAlert")}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {urgentAlerts.slice(0, 3).map((alert, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.15)'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                ⚠️ {alert.parameter_name}: {alert.measured_value}
              </div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                {i18n.language === 'en' ? alert.alert_message_en : alert.alert_message_mr}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 16, marginBottom: 20
        }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>
            🛡️ {t("safetyGuidelines")}
          </h4>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>🚫 {t("doNotDrink")}</div>
            <div>🔥 {t("boilBeforeUse")}</div>
            <div>📞 {t("contactAuthorities")}</div>
            <div>👥 {t("shareConcern")}</div>
          </div>
        </div>

        <button
          onClick={() => setShowAlert(false)}
          style={{
            width: '100%', padding: 12, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.3s'
          }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
        >
          ✅ I Understand
        </button>
      </div>
    </>
  );
};

export default EmergencyAlert;
