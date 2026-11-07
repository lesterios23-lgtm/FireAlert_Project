import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import { apiRequest } from '../../sharedApi';

jest.mock('../../sharedApi', () => ({
  apiRequest: jest.fn(),
}));

const dashboardData = {
  reports: [{
    id: 21,
    attributes: {
      status: 'pending',
      incidentAddress: 'Mansalay Poblacion',
      reportedAt: '2026-11-07T08:00:00Z',
    },
    includes: { resident: { attributes: { name: 'Resident One' } } },
  }],
  users: [],
  firetrucks: [],
};

beforeEach(() => {
  apiRequest.mockResolvedValue({ data: dashboardData });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('shows incident analytics from database records', async () => {
  render(<AdminDashboard />);

  expect(await screen.findByText('Recent incidents')).toBeInTheDocument();
  expect(screen.getByText('Mansalay Poblacion')).toBeInTheDocument();
  expect(screen.getByText('Resident One')).toBeInTheDocument();
  expect(screen.getByText('Awaiting response')).toBeInTheDocument();
});

test('opens account and prediction sections from the administration sidebar', async () => {
  render(<AdminDashboard />);
  await screen.findByText('Recent incidents');

  fireEvent.click(screen.getByRole('button', { name: /user management/i }));
  expect(screen.getByRole('heading', { name: 'Add account' })).toBeInTheDocument();
  expect(screen.getByLabelText('Account type')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Account type'), { target: { value: 'bfp' } });
  expect(screen.getByLabelText('Badge number')).toBeInTheDocument();
  expect(screen.queryByLabelText(/Fire station/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'BFP Member' } });
  fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09171234567' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bfp@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123' } });
  fireEvent.change(screen.getByLabelText('Badge number'), { target: { value: 'MNS-01' } });
  fireEvent.change(screen.getByLabelText('Rank / position'), { target: { value: 'Fire Officer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/users', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      name: 'BFP Member',
      contact_number: '09171234567',
      email: 'bfp@example.test',
      role: 'bfp',
      password: 'Password123',
      personnel: { badge_number: 'MNS-01', rank_position: 'Fire Officer' },
    }),
  })));

  fireEvent.click(screen.getByRole('button', { name: /high-risk predictions/i }));
  await waitFor(() => expect(screen.getByText('Prediction model unavailable')).toBeInTheDocument());
});

test('filters accounts by user category and searchable account details', async () => {
  apiRequest.mockResolvedValue({
    data: {
      ...dashboardData,
      users: [
        { user_id: 1, full_name: 'Admin User', email: 'admin@example.test', role_name: 'System Admin' },
        { user_id: 2, full_name: 'Maria Firefighter', contact_number: '09170000001', email: 'maria@example.test', role_name: 'BFP Staff', badge_number: 'MNS-12', rank_position: 'Fire Officer' },
        { user_id: 3, full_name: 'Resident User', email: 'resident@example.test', role_name: 'Resident' },
      ],
    },
  });
  render(<AdminDashboard />);
  await screen.findByText('Recent incidents');
  fireEvent.click(screen.getByRole('button', { name: /user management/i }));

  expect(screen.getByText('Admin User')).toBeInTheDocument();
  expect(screen.getByText('Maria Firefighter')).toBeInTheDocument();
  expect(screen.getByText('Resident User')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'BFP personnel' }));
  expect(screen.getByText('Maria Firefighter')).toBeInTheDocument();
  expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
  expect(screen.queryByText('Resident User')).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search accounts' }), {
    target: { value: 'MNS-12' },
  });
  expect(screen.getByText('Maria Firefighter')).toBeInTheDocument();
  expect(screen.getByText('1 of 3 accounts')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search accounts' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Admins' }));
  expect(screen.getByText('Admin User')).toBeInTheDocument();
  expect(screen.queryByText('Maria Firefighter')).not.toBeInTheDocument();
  expect(screen.queryByText('Resident User')).not.toBeInTheDocument();
});

test('creates firetrucks without asking the admin to choose the single station', async () => {
  render(<AdminDashboard />);
  await screen.findByText('Recent incidents');

  fireEvent.click(screen.getByRole('button', { name: /firetruck management/i }));
  expect(screen.queryByLabelText('Fire station')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Unit name'), { target: { value: 'Mansalay Engine 1' } });
  fireEvent.change(screen.getByLabelText('Plate number'), { target: { value: 'MNS-F01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add firetruck' }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/firetrucks', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      unit_name: 'Mansalay Engine 1',
      plate_number: 'MNS-F01',
      status: 'Available',
    }),
  })));
});
