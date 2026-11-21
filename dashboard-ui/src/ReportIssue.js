import React, { useEffect, useState } from "react";
import API_URL from "./config";
import { useTranslation } from "react-i18next";

const ReportIssue = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const [sources, setSources] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [category, setCategory] = useState('Water Pollution');
  const [sourceId, setSourceId] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`${API_URL}/api/water-sources`)
      .then((res) => res.json())
      .then((data) => { if (data.data) setSources(data.data); })
      .catch(() => {});

    if (token) {
      fetch(`${API_URL}/api/community-reports`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => { if (data.data) setMyReports(data.data); })
        .catch(() => {});
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError(t('descriptionRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const source = sources.find((s) => String(s.source_id) === String(sourceId));
    const form = new FormData();
    form.append('description', description.trim());
    form.append('category', category);
    if (source) {
      form.append('source_id', source.source_id);
      form.append('source_name', source.source_name);
    }
    if (photo) form.append('photo', photo);

    try {
      const res = await fetch(`${API_URL}/api/community-reports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");

      setMessage(t('reportSubmitted'));
      setDescription("");
      setPhoto(null);
      setMyReports(prev => [data.data, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusStyle = (status) => ({
    padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
    background: status === 'Pending' ? '#fef3c7' : status === 'Resolved' ? '#d1fae5' : '#e2e8f0',
    color: status === 'Pending' ? '#92400e' : status === 'Resolved' ? '#065f46' : '#334155'
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9990, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "rgba(2,6,23,0.55)", backdropFilter: "blur(3px)", padding: 16
    }} onClick={onClose}>
      <div className="glass-card" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: "#0c4a6e" }}>🏞️ {t('reportIssue')}</h3>
          <button onClick={onClose} className="btn-glass" style={{ padding: "4px 10px" }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>{t('reportIssueHint')}</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{t('category')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4 }}>
              {['Water Pollution', 'Garbage Dumping', 'Blocked Drainage', 'Bad Odour', 'Contaminated Supply', 'Other']
                .map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{t('waterSource')}</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4 }}>
              <option value="">{t('selectSource')}</option>
              {sources.map((s) => (
                <option key={s.source_id} value={s.source_id}>
                  {s.source_name} {s.village_name ? `- ${s.village_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{t('description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder={t('descriptionPlaceholder')}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4, resize: "vertical" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{t('photoOptional')}</label>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)}
              style={{ display: "block", marginTop: 6, fontSize: 12 }} />
            {photo && <span style={{ fontSize: 11, color: "#64748b" }}>{photo.name}</span>}
          </div>

          {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {message && <div style={{ background: "#ecfdf5", color: "#047857", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{message}</div>}

          <button type="submit" className="btn-primary" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t('submitting') : `📨 ${t('submitReport')}`}
          </button>
        </form>

        {myReports.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#0c4a6e" }}>{t('myReports')}</h4>
            {myReports.slice(0, 5).map((r) => (
              <div key={r.report_id} style={{
                border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, marginBottom: 8,
                display: "flex", gap: 10, alignItems: "flex-start"
              }}>
                {r.photo_url && (
                  <img src={`${API_URL}${r.photo_url}`} alt="report"
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{r.category}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {r.source_name || "-"} · {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>{r.description}</div>
                  {r.admin_note && (
                    <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4 }}>
                      {t('adminReply')}: {r.admin_note}
                    </div>
                  )}
                </div>
                <span style={statusStyle(r.status)}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportIssue;
