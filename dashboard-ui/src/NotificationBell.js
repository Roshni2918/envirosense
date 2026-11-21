import React, { useState, useEffect, useRef } from "react";
import API_URL from "./config";

const NotificationBell = ({ socket, token, t, i18n }) => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${API_URL}/api/alerts/unresolved`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.data) {
          const items = data.data.slice(0, 5).map(a => ({
            id: a.alert_id,
            type: 'danger',
            title: a.parameter_name,
            message: i18n.language === 'en' ? a.alert_message_en : a.alert_message_mr,
            time: new Date(a.generated_at).toLocaleString()
          }));
          setNotifications(items);
          setUnreadCount(items.length);
        }
      } catch (e) { console.error(e); }
    };
    fetchNotifs();
    if (socket) {
      socket.on('notification', (notif) => {
        setNotifications(prev => [{ ...notif, id: Date.now(), time: new Date().toLocaleString() }, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
      });
      socket.on('new-alert', (alert) => {
        const msg = i18n.language === 'en' ? alert.alert_message_en : alert.alert_message_mr;
        setNotifications(prev => [{
          id: alert.alert_id, type: 'danger', title: alert.parameter_name,
          message: msg, time: new Date(alert.generated_at).toLocaleString()
        }, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
      });
    }
    return () => {
      if (socket) { socket.off('notification'); socket.off('new-alert'); }
    };
  }, [socket, token, i18n.language]);

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const clearAll = () => { setNotifications([]); setUnreadCount(0); };

  const typeColors = { danger: '#ef4444', warning: '#f59e0b', info: '#0ea5e9', success: '#10b981' };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          background: unreadCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)',
          border: unreadCount > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.1)',
          color: unreadCount > 0 ? '#ef4444' : '#94a3b8',
          padding: '8px 12px', borderRadius: 8, cursor: 'pointer', position: 'relative',
          fontSize: 16, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff', fontSize: 10,
            fontWeight: 700, padding: '2px 6px', borderRadius: 10,
            minWidth: 18, textAlign: 'center', lineHeight: '14px'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 360, maxHeight: 420, overflowY: 'auto',
          background: '#1e293b', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)', zIndex: 2000
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
              🔔 {t("notificationTitle")}
            </span>
            {notifications.length > 0 && (
              <button onClick={clearAll} style={{
                background: 'none', border: 'none', color: '#64748b',
                fontSize: 12, cursor: 'pointer', padding: '2px 6px'
              }}>{t("markAllRead")}</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              ✅ {t("notifNoNew")}
            </div>
          ) : (
            notifications.map((n, i) => (
              <div key={n.id || i} style={{
                padding: '12px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i === 0 ? 'rgba(239,68,68,0.06)' : 'transparent',
                transition: 'background 0.2s'
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, marginTop: 1 }}>{n.icon || '⚠️'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: typeColors[n.type] || '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                      {n.title || (n.type === 'danger' ? t("critical") : t("warning"))}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>{n.time}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
