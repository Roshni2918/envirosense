import { useState, useEffect } from "react";
import API_URL from "./config";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const marathiMonths = ["जानेवारी","फेब्रुवारी","मार्च","एप्रिल","मे","जून","जुलै","ऑगस्ट","सप्टेंबर","ऑक्टोबर","नोव्हेंबर","डिसेंबर"];

const WaterCalendar = ({ t, i18n, token }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);

  const monthNames = i18n.language === 'mr' ? marathiMonths : months;

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/calendar-data?year=${currentYear}&month=${currentMonth + 1}`);
      const data = await res.json();
      if (data.data) {
        const map = {};
        data.data.forEach(d => { map[d.date] = d; });
        setCalendarData(map);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentMonth, currentYear]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(prev => prev - 1); }
    else setCurrentMonth(prev => prev - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(prev => prev + 1); }
    else setCurrentMonth(prev => prev + 1);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const dayNames = i18n.language === 'mr'
    ? ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDayColor = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const data = calendarData[dateStr];
    if (!data) return { bg: 'transparent', color: '#475569', label: t("noDataDay") };
    const isSafe = data.avg_ph >= 6.5 && data.avg_ph <= 8.5 && data.avg_tds >= 50 && data.avg_tds <= 300;
    return isSafe
      ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: '#10b981', label: t("healthyDay") }
      : { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '#ef4444', label: t("alertDay") };
  };

  const isToday = (day) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  return (
    <div className="glass-card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0c4a6e', fontWeight: 700 }}>📅 {t("waterCalendar")}</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={prevMonth} className="btn-icon" style={{ padding: '6px 12px', fontSize: 16 }}>◀</button>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#0c4a6e', minWidth: 140, textAlign: 'center' }}>
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button onClick={nextMonth} className="btn-icon" style={{ padding: '6px 12px', fontSize: 16 }}>▶</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t("loading")}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {dayNames.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b',
            padding: '8px 0', textTransform: 'uppercase', letterSpacing: 0.5
          }}>{d}</div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const colors = getDayColor(day);
          return (
            <div
              key={day}
              onClick={() => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                selectedDay === dateStr ? setSelectedDay(null) : setSelectedDay(dateStr);
              }}
              style={{
                padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                background: colors.bg,
                border: `1.5px solid ${isToday(day) ? '#0ea5e9' : 'transparent'}`,
                textAlign: 'center', transition: 'all 0.2s',
                position: 'relative', minHeight: 50
              }}
              title={colors.label}
            >
              <div style={{
                fontSize: 13, fontWeight: isToday(day) ? 700 : 500,
                color: isToday(day) ? '#0ea5e9' : colors.color,
                marginBottom: 2
              }}>{day}</div>
              {calendarData[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`] && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: colors.color, margin: '2px auto 0',
                  opacity: 0.5
                }} />
              )}
              {isToday(day) && (
                <span style={{
                  position: 'absolute', top: 2, right: 4, fontSize: 8,
                  color: '#0ea5e9', fontWeight: 700
                }}>{t("live")}</span>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && calendarData[selectedDay] && (
        <div className="glass-card" style={{
          marginTop: 20, padding: 20,
          background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          animation: 'slideUp 0.3s ease'
        }}>
          <h4 style={{ fontSize: 15, color: '#0c4a6e', margin: '0 0 12px' }}>
            📊 {t("dailyAverage")} — {new Date(selectedDay + 'T00:00:00').toLocaleDateString()}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
            {[
              { label: t("ph"), value: calendarData[selectedDay].avg_ph, unit: '', safe: calendarData[selectedDay].avg_ph >= 6.5 && calendarData[selectedDay].avg_ph <= 8.5 },
              { label: t("tds"), value: calendarData[selectedDay].avg_tds, unit: 'ppm', safe: calendarData[selectedDay].avg_tds >= 50 && calendarData[selectedDay].avg_tds <= 300 },
              { label: t("turbidity"), value: calendarData[selectedDay].avg_turbidity, unit: 'NTU', safe: calendarData[selectedDay].avg_turbidity >= 0 && calendarData[selectedDay].avg_turbidity <= 5 },
            ].map((item, i) => (
              <div key={i} style={{
                background: '#fff', padding: '10px 12px', borderRadius: 10,
                textAlign: 'center', border: `1px solid ${item.safe ? '#d1fae5' : '#fecaca'}`
              }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: item.safe ? '#10b981' : '#ef4444', margin: '2px 0' }}>
                  {item.value} {item.unit}
                </div>
                <div style={{ fontSize: 10, color: item.safe ? '#10b981' : '#ef4444' }}>
                  {item.safe ? '✅ Safe' : '⚠️ Unsafe'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
            📈 {calendarData[selectedDay].readings} {t("sensorName")} on this day
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981' }} />
          {t("healthyDay")}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444' }} />
          {t("alertDay")}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'transparent', border: '1px solid #475569' }} />
          {t("noDataDay")}
        </div>
      </div>
    </div>
  );
};

export default WaterCalendar;
