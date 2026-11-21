import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: jest.fn() }
  })
}));

jest.mock('socket.io-client', () => ({
  io: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn() })
}));

jest.mock('./WaterSourcesMap', () => () => <div data-testid="water-map" />);

beforeAll(() => {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: [] })
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

test('explains that alerts are automatic for every registered user', async () => {
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: 'regAlertTitle' })).toBeInTheDocument();
  expect(screen.getByText('regAlertDesc')).toBeInTheDocument();
  expect(screen.getByText('regBenefit1')).toBeInTheDocument();
  expect(screen.getByText('regHowEmail')).toBeInTheDocument();
  expect(screen.getByText('regHowSms')).toBeInTheDocument();
  expect(screen.getByText('regHowInApp')).toBeInTheDocument();
});

test('shows no separate registration form', async () => {
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

  expect(screen.queryByRole('button', { name: 'regSubmit' })).toBeNull();
  expect(screen.queryByPlaceholderText('you@example.com')).toBeNull();
});
