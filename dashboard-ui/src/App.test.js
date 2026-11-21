import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./Landing', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'Landing Page');
});
jest.mock('./Register', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'Register Page');
});
jest.mock('./Login', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'Login Page');
});
jest.mock('./LoginChoice', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'Login Choice Page');
});
jest.mock('./Dashboard', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'User Dashboard');
});
jest.mock('./AdminLogin', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'Admin Login Page');
});
jest.mock('./AdminDashboard', () => {
  const React = require('react');
  return () => React.createElement('div', null, 'Admin Dashboard');
});

test('boots the app and renders the landing page on the default route', () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(screen.getByText('Landing Page')).toBeInTheDocument();
});
