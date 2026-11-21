import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReportIssue from './ReportIssue';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: jest.fn() }
  })
}));

const respond = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  global.fetch = jest.fn(async (url) => {
    const target = String(url);
    if (target.includes('/api/water-sources')) {
      return respond([
        { source_id: 1, source_name: 'Nagaon Well', village_name: 'Nagaon' }
      ]);
    }
    if (target.includes('/api/community-reports')) return respond([]);
    return respond([]);
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the report form and loads water sources', async () => {
  render(<ReportIssue onClose={jest.fn()} />);

  expect(screen.getByRole('heading', { name: /reportIssue/ })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('descriptionPlaceholder')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('option', { name: /Nagaon Well/ })).toBeInTheDocument());
});

test('blocks submission when the description is empty', async () => {
  render(<ReportIssue onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole('option', { name: /Nagaon Well/ })).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /submitReport/ }));

  await waitFor(() => expect(screen.getByText('descriptionRequired')).toBeInTheDocument());
});
