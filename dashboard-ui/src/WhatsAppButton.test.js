import { render, screen } from '@testing-library/react';
import WhatsAppButton from './WhatsAppButton';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: jest.fn() }
  })
}));

test('opens WhatsApp chat with the admin number 8605052931', () => {
  render(<WhatsAppButton />);
  const link = screen.getByTestId('whatsapp-button');
  expect(link).toHaveAttribute('href', 'https://wa.me/918605052931?text=waMessage');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link).toHaveAttribute('aria-label', 'waLabel');
});

test('shows the chat label so users know it is for queries', () => {
  render(<WhatsAppButton />);
  expect(screen.getByText('waLabel')).toBeInTheDocument();
});
