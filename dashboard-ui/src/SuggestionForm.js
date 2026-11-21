import { useState } from "react";
import API_URL from "./config";
import "./App.css";

function SuggestionForm({ onClose }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [form, setForm] = useState({ subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.message) return alert("Please fill all fields");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.message) {
        setDone(true);
        setTimeout(() => { if (onClose) onClose(); }, 2000);
      }
    } catch { alert("Failed to submit"); }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="suggestion-overlay">
        <div className="suggestion-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3>Submitted Successfully!</h3>
          <p style={{ color: "#64748b", marginTop: 8 }}>Admin will review your query shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="suggestion-overlay" onClick={onClose}>
      <div className="suggestion-card" onClick={(e) => e.stopPropagation()}>
        <div className="suggestion-header">
          <h3>💬 Submit Suggestion / Query</h3>
          <button className="suggestion-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="suggestion-field">
            <label>Your Name</label>
            <input type="text" value={user.name || ""} disabled />
          </div>
          <div className="suggestion-field">
            <label>Email</label>
            <input type="email" value={user.email || ""} disabled />
          </div>
          <div className="suggestion-field">
            <label>Subject</label>
            <input type="text" placeholder="e.g., Water quality concern, Feature request" value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </div>
          <div className="suggestion-field">
            <label>Your Message</label>
            <textarea rows="5" placeholder="Describe your query or suggestion in detail..." value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          </div>
          <button className="btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Query"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SuggestionForm;
