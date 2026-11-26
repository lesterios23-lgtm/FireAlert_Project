import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import { apiRequest } from '../../sharedApi';

jest.mock('../../sharedApi', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('../shared/GoogleMap', () => function MockGoogleMap({ markers = [], heatmapPoints = [] }) {
  return (
    <div
      aria-label='Map'
      data-marker-count={markers.length}
      data-heatmap-count={heatmapPoints.length}
    />
  );
});

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
  login_attempt_settings: { max_attempts: 5, lockout_minutes: 15 },
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
  expect(screen.getByText('Total reports*')).toBeInTheDocument();
  expect(screen.getByText('Active reports*')).toBeInTheDocument();
  expect(screen.getByText('Units assigned*')).toBeInTheDocument();
  expect(screen.getByText('High-risk areas*')).toBeInTheDocument();
});

test('lets an administrator update failed-login threshold and lockout duration', async () => {
  render(<AdminDashboard />);
  await screen.findByText('Recent incidents');
  fireEvent.click(screen.getByRole('button', { name: /user management/i }));

  expect(screen.getByLabelText('Failed attempts before lockout')).toHaveValue(5);
  expect(screen.getByLabelText('Lockout duration (minutes)')).toHaveValue(15);
  fireEvent.change(screen.getByLabelText('Failed attempts before lockout'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Lockout duration (minutes)'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save security settings' }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/login-attempt-settings', expect.objectContaining({
    method: 'PUT',
    body: JSON.stringify({ max_attempts: 3, lockout_minutes: 10 }),
  })));
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

test('toggles seasonal high-risk heatmap overlay and switches season filter', async () => {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith('/admin/high-risk-areas')) {
      return Promise.resolve({
        data: {
          model_available: true,
          generated_at: '2026-11-27T00:00:00Z',
          period: '365',
          total_incidents_analyzed: 5,
          methodology: 'Reference + historical analysis.',
          high_risk_locations: [],
          reference_barangays: [{
            barangay_name: 'Panaytayan',
            latitude: 12.52,
            longitude: 121.43,
            reference_risk_level: 'High',
            historical: { available: false, incident_count: 0 },
          }],
        },
      });
    }
    if (path === '/admin/risk-heatmap?season=dry') {
      return Promise.resolve({
        data: {
          season: 'dry',
          count: 2,
          points: [
            { latitude: 12.5205, longitude: 121.4385, barangay_name: 'Poblacion', severity: 'Large', intensity: 1.0 },
            { latitude: 12.528, longitude: 121.442, barangay_name: 'B. del Mundo', severity: 'Medium', intensity: 0.7 },
          ],
        },
      });
    }
    if (path === '/admin/risk-heatmap?season=wet') {
      return Promise.resolve({
        data: {
          season: 'wet',
          count: 1,
          points: [
            { latitude: 12.511, longitude: 121.431, barangay_name: 'Santa Teresita', severity: 'Small', intensity: 0.4 },
          ],
        },
      });
    }
    return Promise.resolve({ data: dashboardData });
  });

  render(<AdminDashboard />);
  await screen.findByText('Recent incidents');

  fireEvent.click(screen.getByRole('button', { name: /high-risk predictions/i }));
  const toggle = await screen.findByLabelText(/Show Seasonal High-Risk Zones/i);
  const seasonSelect = screen.getByLabelText(/Seasonal heatmap filter/i);
  expect(seasonSelect).toBeDisabled();

  fireEvent.click(toggle);
  expect(seasonSelect).not.toBeDisabled();

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/risk-heatmap?season=dry'));
  expect(await screen.findByText('2 incident points plotted')).toBeInTheDocument();
  expect(screen.getByLabelText('Seasonal heatmap risk legend')).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-heatmap-count', '2');

  fireEvent.change(seasonSelect, { target: { value: 'wet' } });
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/risk-heatmap?season=wet'));
  expect(await screen.findByText('1 incident point plotted')).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-heatmap-count', '1');

  fireEvent.click(toggle);
  expect(seasonSelect).toBeDisabled();
  expect(screen.queryByLabelText('Seasonal heatmap risk legend')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-heatmap-count', '0');
});

test('pins only predicted high-risk locations on the map and updates when switching forecast day', async () => {
  const forecastDays = [
    { day_index: 0, date: '2026-11-27', label: 'Today', high_risk_count: 1, avg_temp_max: 34.5, avg_precip_mm: 0 },
    { day_index: 1, date: '2026-11-28', label: 'Tomorrow', high_risk_count: 0, avg_temp_max: 27.0, avg_precip_mm: 18 },
  ];
  const day0Locations = [
    {
      barangay_name: 'Panaytayan',
      latitude: 12.5427,
      longitude: 121.3334,
      reference_risk_level: 'High',
      predicted_risk_level: 'High',
      predicted_risk_score: 76,
      weather: { condition_label: 'Clear sky', temp_max_c: 35.4, humidity_min_pct: 42, wind_max_kmh: 26, precipitation_mm: 0 },
      reasons: ['Hot conditions (35.4°C max)'],
      historical: { available: false, incident_count: 0 },
    },
    {
      barangay_name: 'Don Pedro',
      latitude: 12.4894,
      longitude: 121.4241,
      reference_risk_level: 'Moderate',
      predicted_risk_level: 'Low',
      predicted_risk_score: 24,
      weather: { condition_label: 'Rain', temp_max_c: 27.0, humidity_min_pct: 84, wind_max_kmh: 8, precipitation_mm: 18 },
      reasons: ['Heavy rainfall suppresses fire risk (18.0 mm)'],
      historical: { available: false, incident_count: 0 },
    },
  ];
  const day1Locations = day0Locations.map((loc) => ({
    ...loc,
    predicted_risk_level: 'Low',
    predicted_risk_score: 18,
  }));

  apiRequest.mockImplementation((path) => {
    if (path.startsWith('/admin/high-risk-areas') && path.includes('day=1')) {
      return Promise.resolve({
        data: {
          model_available: true,
          weather_available: true,
          generated_at: '2026-11-27T01:00:00Z',
          period: '365',
          selected_day_index: 1,
          forecast_days: forecastDays,
          reference_barangays: day1Locations,
          daily_predictions: day1Locations,
          high_risk_locations: [],
        },
      });
    }
    if (path.startsWith('/admin/high-risk-areas')) {
      return Promise.resolve({
        data: {
          model_available: true,
          weather_available: true,
          generated_at: '2026-11-27T01:00:00Z',
          period: '365',
          selected_day_index: 0,
          forecast_days: forecastDays,
          reference_barangays: day0Locations,
          daily_predictions: day0Locations,
          high_risk_locations: [day0Locations[0]],
        },
      });
    }
    return Promise.resolve({ data: dashboardData });
  });

  render(<AdminDashboard />);
  await screen.findByText('Recent incidents');

  fireEvent.click(screen.getByRole('button', { name: /high-risk predictions/i }));

  // Today: 2 areas monitored, ONLY 1 High-Risk area pinned on the map
  await screen.findByLabelText('7-day fire risk forecast');
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-marker-count', '1');
  expect(screen.getByText('1 high-risk pin shown on map')).toBeInTheDocument();

  // Switch to Tomorrow: 0 High-Risk areas -> 0 pins on map & safe banner shown
  fireEvent.click(screen.getByRole('button', { name: /Tomorrow/i }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/high-risk-areas?period=365&day=1'));
  expect(await screen.findByText(/No high-risk fire zones predicted for Tomorrow/i)).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-marker-count', '0');
});
