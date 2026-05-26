import { useState, useEffect } from "react";

const sourceTypeIcons = {
  Well: "🪣", River: "🌊", Lake: "🏞️", Pond: "🪷", Borewell: "⛲"
};

const sourceTypeColors = {
  Well: { bg: "#dbeafe", text: "#1e40af" },
  River: { bg: "#d1fae5", text: "#065f46" },
  Lake: { bg: "#e0f2fe", text: "#0c4a6e" },
  Borewell: { bg: "#fef3c7", text: "#92400e" },
  default: { bg: "#f1f5f9", text: "#475569" }
};

const WaterSourcesMap = ({ t, i18n }) => {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/water-sources");
        const data = await res.json();
        if (data.data) setSources(data.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchSources();
  }, []);

  const mapEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d30266!2d74.115!3d17.128!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc47e1b0a8b9b6f%3A0xb1c8f8e8e8e8e8e8!2sNagaon%2C+Maharashtra!5e0!3m2!1sen!2sin!4v1";

  return (
    <div>
      <div style={{
        borderRadius: 16, overflow: 'hidden', marginBottom: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0'
      }}>
        <iframe
          title="Nagaon Water Sources Map"
          src={mapEmbedUrl}
          width="100%"
          height="380"
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t("loading")}</div>}

      {!loading && sources.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t("noData")}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {sources.map(source => {
          const colors = sourceTypeColors[source.source_type] || sourceTypeColors.default;
          return (
            <div
              key={source.source_id}
              onClick={() => setSelectedSource(selectedSource?.source_id === source.source_id ? null : source)}
              className="glass-card"
              style={{
                padding: 20, cursor: 'pointer', transition: 'all 0.3s',
                border: selectedSource?.source_id === source.source_id ? `2px solid ${colors.text}` : '1px solid #e2e8f0',
                position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: colors.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 26, flexShrink: 0
                }}>
                  {sourceTypeIcons[source.source_type] || '💧'}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#0c4a6e' }}>
                    {source.source_name}
                  </h4>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                    {source.village_name} · {source.source_type}
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                    fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.text
                  }}>
                    ● {source.source_status}
                  </span>
                </div>
              </div>

              {source.description_text && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
                  {source.description_text}
                </div>
              )}

              {selectedSource?.source_id === source.source_id && (
                <div style={{
                  marginTop: 16, padding: 14, background: '#f8fafc', borderRadius: 10,
                  animation: 'slideUp 0.2s ease'
                }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                    📍 {source.latitude}, {source.longitude}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    🆔 Source ID: {source.source_id}
                  </div>
                  <div style={{
                    marginTop: 10, padding: 8, background: '#fff', borderRadius: 8,
                    border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b'
                  }}>
                    🗺️ <strong>Location:</strong> {source.village_name}, Nagaon, Maharashtra
                    <br />
                    <a
                      href={`https://www.google.com/maps?q=${source.latitude},${source.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}
                    >
                      📌 Open in Google Maps →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, padding: '14px 20px',
        background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
        borderRadius: 12, border: '1px solid #bae6fd',
        fontSize: 13, color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: 10
      }}>
        <span style={{ fontSize: 20 }}>📍</span>
        <span>
          <strong>Nagaon, Maharashtra</strong> · {sources.length} active monitoring stations
          <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Click any source card above to view location details and open in Google Maps
          </span>
        </span>
      </div>
    </div>
  );
};

export default WaterSourcesMap;
