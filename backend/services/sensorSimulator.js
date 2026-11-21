// Professional sensor simulation — pH, TDS and Turbidity only.
// Every hourly sample drifts only slightly (a few hundredths of a pH unit,
// a couple of ppm of TDS, a few hundredths of an NTU) so successive readings
// look like a real probe: small jitter around a slowly moving baseline.

const BASELINE = { ph: 7.2, tds: 180, turbidity: 2.1 };
const LIMITS = { ph: [6.8, 8.0], tds: [60, 260], turbidity: [0.4, 5.5] };
// Maximum random step per hourly sample — this is what keeps readings "close".
const STEP = { ph: 0.04, tds: 2.5, turbidity: 0.06 };

const sensorState = { ...BASELINE };

const getSeason = (now = new Date()) => {
  const month = now.getMonth();
  if (month >= 3 && month <= 5) return 'summer';
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 10 && month <= 11) return 'post-monsoon';
  return 'winter';
};

// Bounded random walk with a gentle pull back to the seasonal/hourly baseline.
const drift = (value, baseline, step, range) => {
  const noise = (Math.random() - 0.5) * 2 * step;
  const pull = (baseline - value) * 0.05;
  const next = value + noise + pull;
  return Math.max(range[0], Math.min(range[1], next));
};

const generateSensorData = (now = new Date()) => {
  const hour = now.getHours();
  const season = getSeason(now);
  // Slow diurnal wobble (-1 .. 1) — rivers warm up / crops get irrigated during the day.
  const diurnal = Math.sin(((hour - 6) / 24) * Math.PI * 2);

  const phBaseline = BASELINE.ph + diurnal * 0.05;
  const tdsBaseline = BASELINE.tds + diurnal * 6 + (season === 'summer' ? 12 : season === 'monsoon' ? -10 : 0);
  const turbidityBaseline = BASELINE.turbidity
    + (season === 'monsoon' ? 1.2 : season === 'post-monsoon' ? 0.4 : 0)
    + Math.abs(diurnal) * 0.1;

  sensorState.ph = drift(sensorState.ph, phBaseline, STEP.ph, LIMITS.ph);
  sensorState.tds = drift(sensorState.tds, tdsBaseline, STEP.tds, LIMITS.tds);
  sensorState.turbidity = drift(sensorState.turbidity, turbidityBaseline, STEP.turbidity, LIMITS.turbidity);

  return {
    ph: Math.round(sensorState.ph * 100) / 100,
    tds: Math.round(sensorState.tds),
    turbidity: Math.round(sensorState.turbidity * 100) / 100
  };
};

// Warm-start the simulator from the newest stored reading so the first sample
// after a restart continues seamlessly from history.
const seedState = (reading) => {
  if (!reading) return;
  if (!isNaN(parseFloat(reading.ph))) sensorState.ph = parseFloat(reading.ph);
  if (!isNaN(parseFloat(reading.tds))) sensorState.tds = parseFloat(reading.tds);
  if (!isNaN(parseFloat(reading.turbidity))) sensorState.turbidity = parseFloat(reading.turbidity);
};

module.exports = { generateSensorData, seedState, sensorState, BASELINE, LIMITS, STEP };
