import React, { useMemo } from "react";

const PARAMS = [
  { key: 'ph', nameKey: 'ph', unit: 'pH', min: 6.5, max: 8.5 },
  { key: 'tds', nameKey: 'tds', unit: 'ppm', min: 50, max: 300 },
  { key: 'turbidity', nameKey: 'turbidity', unit: 'NTU', min: 0, max: 5 }
];

const STEP_MINUTES = 60;      // one reading per hour
const HORIZON_HOURS = 6;      // 6-hour forecast window

const linearFit = (values) => {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - meanX) * (values[i] - meanY);
    den += (x - meanX) * (x - meanX);
  });
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const median = (arr) => {
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
};

// Drop sensor glitches / legacy outliers so a single bad sample
// (e.g. an old alert-test reading) cannot skew the whole trend line.
const sanitize = (values) => {
  if (values.length < 5) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)));
  const tolerance = mad > 0 ? mad * 3 : Math.max(Math.abs(med) * 0.05, 1e-6);
  // always keep the most recent sample - it anchors the trend to "now"
  const kept = values.filter((v, i) => i === values.length - 1 || Math.abs(v - med) <= tolerance);
  return kept.length >= 4 ? kept : values;
};

const ForecastCard = ({ readings = [], t }) => {
  const forecast = useMemo(() => {
    const recent = readings
      .filter((r) => r && !isNaN(parseFloat(r.ph)))
      .slice(0, 18)
      .reverse();

    if (recent.length < 4) return null;

    return PARAMS.map((param) => {
      const series = sanitize(recent.map((r) => parseFloat(r[param.key])).filter((v) => !isNaN(v)));
      if (series.length < 4) return null;

      const { slope, intercept } = linearFit(series);
      const last = series[series.length - 1];
      const at = (step) => clamp(intercept + slope * (series.length - 1 + step), param.min, param.max);

      const windows = [];
      for (let step = 1; step <= HORIZON_HOURS; step++) {
        const value = at(step);
        const safe = value >= param.min && value <= param.max;
        const time = new Date(Date.now() + step * STEP_MINUTES * 60 * 1000);
        windows.push({ step, value, safe, time });
      }

      const first = windows[0];
      const lastWindow = windows[windows.length - 1];
      const firstUnsafe = windows.find((w) => !w.safe);
      const unsafeCount = windows.filter((w) => !w.safe).length;

      return {
        param,
        current: last,
        min: Math.min(last, ...windows.map((w) => w.value)),
        max: Math.max(last, ...windows.map((w) => w.value)),
        first,
        last: lastWindow,
        firstUnsafe,
        unsafeCount,
        direction: slope > 0.001 ? 'rising' : slope < -0.001 ? 'falling' : 'stable',
        overallSafe: unsafeCount === 0
      };
    }).filter(Boolean);
  }, [readings]);

  if (!forecast || forecast.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }} data-testid="forecast-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: '#0c4a6e' }}>🔮 {t('next6Hours')}</h3>
        <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(14,165,233,0.08)', padding: '2px 8px', borderRadius: 8 }}>
          {t('basedOnReadings')}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>{t('forecastMethod')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {forecast.map((f) => {
          const unsafe = !f.overallSafe;
          return (
            <div key={f.param.key} style={{
              border: '1px solid', borderRadius: 12, padding: 12,
              borderColor: unsafe ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)',
              background: unsafe ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: '#0c4a6e' }}>{t(f.param.nameKey)}</strong>
                <span style={{ fontSize: 12, fontWeight: 600, color: unsafe ? '#ef4444' : '#10b981' }}>
                  {unsafe ? '⚠️ ' + t('unsafe') : '✅ ' + t('safe')}
                </span>
              </div>

              <div style={{ fontSize: 20, fontWeight: 700, color: unsafe ? '#ef4444' : '#0c4a6e', marginTop: 6 }}>
                {f.min.toFixed(f.param.key === 'ph' ? 2 : 1)} – {f.max.toFixed(f.param.key === 'ph' ? 2 : 1)}
                <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}> {f.param.unit}</span>
              </div>

              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {t('now')}: {f.current} {f.param.unit} · {f.direction === 'rising' ? '↗' : f.direction === 'falling' ? '↘' : '→'} {t(`direction.${f.direction}`)}
              </div>

              <div style={{ fontSize: 11, marginTop: 6, color: unsafe ? '#b91c1c' : '#047857' }}>
                {f.firstUnsafe
                  ? t('unsafeExpectedAt') + ' ' + f.firstUnsafe.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : t('expectedSafe')}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', margin: '12px 0 0' }}>{t('forecastDisclaimer')}</p>
    </div>
  );
};

export default ForecastCard;
