import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ResidentShell from './ResidentShell';

jest.mock('../../sharedApi', () => {
  const actual = jest.requireActual('../../sharedApi');
  return { ...actual, apiRequest: jest.fn(() => Promise.resolve({ data: [] })) };
});

jest.mock('./EmergencyReportScreen', () => function MockEmergencyReportScreen() {
  return <h1>Report fire screen</h1>;
});

jest.mock('./ResponseTrackingScreen', () => function MockResponseTrackingScreen() {
  return <h1>Response tracking screen</h1>;
});

jest.mock('./SubmissionHistoryScreen', () => function MockSubmissionHistoryScreen() {
  return <h1>My reports screen</h1>;
});

const user = {
  name: 'Resident Example',
  email: 'resident@example.test',
  contact_number: '09171234567',
  role: 'resident',
};

test('opens the resident dashboard as the landing tab', () => {
  render(<ResidentShell user={user} onLogout={jest.fn()} />);

  expect(screen.getByRole('heading', { name: 'Hi, Resident Example' })).toBeInTheDocument();
  expect(screen.getByText('May sunog? Unahin ang kaligtasan. Lumayo sa panganib at tumawag sa 911.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Contact Information' })).toBeInTheDocument();
  expect(screen.getByText('0915-603-1507')).toBeInTheDocument();
  expect(screen.getByText('0921-850-7600')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(2);
  expect(screen.getByRole('heading', { name: 'BFP Announcements' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /View All Announcements/i })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Fire prevention tips' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add home address' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Your home address' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /View All Safety Tips/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add home address' }));
  expect(screen.getByRole('dialog', { name: 'Your home address' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close address form' }));
  expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Report fire' })).toBeInTheDocument();
});

test('uses the centered report action and profile tab for resident navigation', () => {
  render(<ResidentShell user={{ ...user, address: 'Purok 1, Barangay Poblacion' }} onLogout={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Report fire' }));
  expect(screen.getByRole('heading', { name: 'Report fire screen' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Report fire' })).toHaveAttribute('aria-current', 'page');

  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  expect(screen.getByDisplayValue('Resident Example')).toBeInTheDocument();
  expect(screen.getByDisplayValue('resident@example.test')).toBeInTheDocument();
  expect(screen.getByDisplayValue('09171234567')).toBeInTheDocument();
  expect(screen.getByText(/Change photo|Add profile photo/i)).toBeInTheDocument();
});

test('asks for confirmation before signing out from resident profile', () => {
  const onLogout = jest.fn();
  render(<ResidentShell user={user} onLogout={onLogout} />);

  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

  // Logout is gated behind the confirmation modal.
  expect(onLogout).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Sign out?' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onLogout).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: 'Sign out?' })).not.toBeInTheDocument();
});

test('signs out after confirming in the logout modal', () => {
  const onLogout = jest.fn();
  render(<ResidentShell user={user} onLogout={onLogout} />);

  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

  const dialog = screen.getByRole('dialog', { name: 'Sign out?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));

  expect(onLogout).toHaveBeenCalledTimes(1);
});
