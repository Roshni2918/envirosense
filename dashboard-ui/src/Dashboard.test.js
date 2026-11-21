import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: jest.fn() }
  })
}));

jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));

const latest = {
  reading_id: 150,
  recorded_at: new Date().toISOString(),
  ph: 7.2, tds: 165, turbidity: 2.4
};

const readings = [
  latest,
  { ...latest, reading_id: 149, recorded_at: new Date(Date.now() - 600000).toISOString(), ph: 7.1 },
  { ...latest, reading_id: 148, recorded_at: new Date(Date.now() - 1200000).toISOString(), ph: 7.3 },
  { ...latest, reading_id: 147, recorded_at: new Date(Date.now() - 1800000).toISOString(), ph: 7.05 },
  { ...latest, reading_id: 146, recorded_at: new Date(Date.now() - 2400000).toISOString(), ph: 7.35 },
  { ...latest, reading_id: 145, recorded_at: new Date(Date.now() - 3000000).toISOString(), ph: 7.15 }
];

const respond = (data) => ({
  ok: true,
  status: 200,
  json: async () => ({ data }),
  blob: async () => new Blob()
});

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ name: 'Test User' }));
  global.Notification = { permission: 'denied', requestPermission: jest.fn() };
  global.fetch = jest.fn(async (url) => {
    const target = String(url);
    if (target.includes('/api/sensor-data/latest')) return respond(latest);
    if (target.includes('/api/sensor-data')) return respond(readings);
    if (target.includes('/api/system-health')) {
      return respond({
        status: 'healthy', totalReadings: 150, activeAlerts: 0, activeUsers: 3,
        activeSensors: 1, minutesSinceLastReading: 1, lastHourReadings: 6,
        lastReading: new Date().toISOString()
      });
    }
    return respond([]);
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

test('mounts without runtime errors and shows live readings', async () => {
  renderDashboard();
  await screen.findByText(/No active alerts/);

  expect(document.querySelectorAll('.param-box')).toHaveLength(3);
  expect(document.querySelectorAll('.wqi-ring')).toHaveLength(1);
});

test('no longer renders the real-time sensor graph', async () => {
  renderDashboard();
  await screen.findByText(/No active alerts/);

  expect(screen.queryByText(/real-time/i)).toBeNull();
  expect(screen.queryByText(/Real-Time Trends/i)).toBeNull();
  expect(document.querySelector('canvas')).toBeNull();
});

test('keeps the alerts feed and the sensor history table', async () => {
  renderDashboard();
  await screen.findByText(/No active alerts/);

  expect(document.querySelectorAll('table tbody tr')).toHaveLength(readings.length);
});

test('shows the next 6 hours forecast card', async () => {
  renderDashboard();
  await screen.findByText(/No active alerts/);

  const card = document.querySelector('[data-testid="forecast-card"]');
  expect(card).not.toBeNull();
  expect(card.textContent).toMatch(/next6Hours/);
  expect(card.textContent).toMatch(/unsafeExpectedAt|expectedSafe/);
});
