import React, { useState, useEffect } from "react";
import API_URL from "./config";

const ProfileSettings = ({ t, token, user, onClose, onUpdate }) => {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState(user.village_name || '');
  const [language, setLanguage] = useState(user.language_preference || 'en');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.data) {
          setName(data.data.user_name || '');
          setPhone(data.data.mobile_no || '');
          setVillage(data.data.village_name || '');
          setLanguage(data.data.language_preference || 'en');
        }
      } catch (e) { console.error(e); }
    };
    fetchProfile();
  }, [token]);

  const updateProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, village_name: village, language_preference: language })
      });
      const data = await res.json();
      setMessage({ type: res.ok ? 'success' : 'error', text: data.message });
      if (res.ok) onUpdate?.();
    } catch (e) { setMessage({ type: 'error', text: 'Failed to update profile' }); }
    setLoading(false);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'Passwords do not match' });
    if (newPassword.length < 4) return setMessage({ type: 'error', text: 'Password must be at least 4 characters' });
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/change-password`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      setMessage({ type: res.ok ? 'success' : 'error', text: data.message });
      if (res.ok) { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    } catch (e) { setMessage({ type: 'error', text: 'Failed to change password' }); }
    setLoading(false);
  };

  return (
    <div className="suggestion-overlay" onClick={(e) => e.target.className === 'suggestion-overlay' && onClose()}>
      <div className="suggestion-card" style={{ maxWidth: 560 }}>
        <div className="suggestion-header">
          <h3>⚙️ {t("profileSettings")}</h3>
          <button onClick={onClose} className="suggestion-close">✕</button>
        </div>

        {message && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
            background: message.type === 'success' ? '#d1fae5' : '#fef2f2',
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`
          }}>
            {message.text}
          </div>
        )}

        <h4 style={{ fontSize: 14, color: '#0c4a6e', marginBottom: 12 }}>👤 {t("profile")}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="suggestion-field">
            <label>{t("name")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
          </div>
          <div className="suggestion-field">
            <label>{t("phone")}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />
          </div>
          <div className="suggestion-field">
            <label>{t("village")}</label>
            <input value={village} onChange={e => setVillage(e.target.value)} placeholder="Village" />
          </div>
          <div className="suggestion-field">
            <label>{t("language")}</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="mr">मराठी</option>
            </select>
          </div>
        </div>
        <button className="btn-primary" onClick={updateProfile} disabled={loading} style={{ width: '100%' }}>
          {loading ? t("loading") : t("saveChanges")}
        </button>

        <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

        <h4 style={{ fontSize: 14, color: '#0c4a6e', marginBottom: 12 }}>🔑 {t("changePassword")}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div className="suggestion-field">
            <label>{t("currentPassword")}</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
          <div className="suggestion-field">
            <label>{t("newPassword")}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="suggestion-field">
            <label>{t("confirmPassword")}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={changePassword} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          {loading ? t("loading") : t("changePassword")}
        </button>
      </div>
    </div>
  );
};

export default ProfileSettings;
