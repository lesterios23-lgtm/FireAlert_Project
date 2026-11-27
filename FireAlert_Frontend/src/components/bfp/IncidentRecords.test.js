import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BFPShell from './BFPShell';
import IncidentRecords from './IncidentRecords';
import { apiRequest } from '../../sharedApi';

jest.mock('./EmergencyCommandCenter', () => function MockCommandCenter() {
  return <div>Command Center View</div>;
});

jest.mock('../shared/GoogleMap', () => function MockGoogleMap() {
  return <div aria-label='Map' />;
});

jest.mock('../../sharedApi', () => ({
  ...jest.requireActual('../../sharedApi'),
  apiRequest: jest.fn(),
}));

const commandCenter = {
  data: {
    reports: [{
      id: 7,
      attributes: {
        incidentAddress: 'Barangay Poblacion',
        incidentDescription: 'Kitchen fire.',
        status: 'pending',
        reportedAt: '2026-11-04T10:00:00Z',
      },
      includes: { resident: { attributes: { name: 'Resident' } } },
      incidentRecord: null,
    }],
    stations: [],
    trucks: [],
    personnel: [],
    statuses: [{ status_id: 1, status_name: 'Submitted' }],
  },
};

const analyticsCommandCenter = {
  data: {
    reports: [
      {
        id: 12,
        attributes: {
          incidentAddress: 'Sitio Ilangawin, Brgy. B. Del Mundo, Mansalay, Oriental Mindoro',
          incidentDescription: 'Residential blaze. Estimated fire size: large.',
          status: 'resolved',
          reportedAt: '2026-11-13T02:52:00Z',
        },
        includes: { resident: { attributes: { name: 'Lester Jhon' } } },
        dispatch: {
          unit_name: 'Engine 01',
          plate_number: 'BFP-101',
          personnel_name: 'FO1 Santos',
          dispatched_at: '2026-11-13T02:54:00Z',
          arrived_at: '2026-11-13T03:02:00Z',
          estimated_eta_minutes: 8,
        },
        incidentRecord: {
          record_id: 4,
          damage_assessment: 'Roof partially burned.',
          casualties_count: 2,
          resolution_summary: 'Fire contained and overhauled.',
          archived_at: '2026-11-13T04:00:00Z',
        },
      },
      {
        id: 11,
        attributes: {
          incidentAddress: 'Brgy. Balugo, Mansalay, Oriental Mindoro',
          incidentDescription: 'Brush fire. Estimated fire size: small.',
          status: 'pending',
          reportedAt: '2026-11-10T05:10:00Z',
        },
        includes: { resident: { attributes: { name: 'Jobert Jamal' } } },
        dispatch: null,
        incidentRecord: null,
      },
    ],
    stations: [],
    trucks: [
      { truck_id: 1, unit_name: 'Engine 01', plate_number: 'BFP-101', status: 'Available' },
    ],
    personnel: [
      { personnel_id: 3, user_id: 10, full_name: 'FO1 Santos', rank_position: 'Fire Officer 1', badge_number: 'B-104' },
    ],
    statuses: [
      { status_id: 1, status_name: 'Submitted' },
      { status_id: 5, status_name: 'Resolved' },
    ],
  },
};

afterEach(() => jest.clearAllMocks());

test('loads incident records from command center data, saves once, and locks as read-only', async () => {
  const savedCommandCenter = {
    data: {
      ...commandCenter.data,
      reports: [{
        ...commandCenter.data.reports[0],
        incidentRecord: {
          record_id: 9,
          damage_assessment: 'Kitchen cabinets damaged.',
          casualties_count: 1,
          resolution_summary: 'Fire extinguished.',
          archived_at: '2026-11-04T11:00:00Z',
        },
      }],
    },
  };

  apiRequest
    .mockResolvedValueOnce(commandCenter)
    .mockResolvedValueOnce({ data: null, message: 'Incident record saved' })
    .mockResolvedValueOnce(savedCommandCenter);
  render(<IncidentRecords />);

  await screen.findByRole('heading', { name: 'FA-000007' });
  expect(screen.queryByRole('option', { name: 'Rejected' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Damage assessment'), {
    target: { value: 'Kitchen cabinets damaged.' },
  });
  fireEvent.change(screen.getByLabelText('Casualties count'), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByLabelText('Resolution summary'), {
    target: { value: 'Fire extinguished.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save incident record' }));

  await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/reports/7/incident-record', expect.objectContaining({
    method: 'PUT',
    body: JSON.stringify({
      damage_assessment: 'Kitchen cabinets damaged.',
      casualties_count: 1,
      resolution_summary: 'Fire extinguished.',
    }),
  })));
  expect(apiRequest).toHaveBeenNthCalledWith(3, '/command-center');

  expect(await screen.findByText('Saved · Read-only')).toBeInTheDocument();
  expect(screen.getByText('Kitchen cabinets damaged.')).toBeInTheDocument();
  expect(screen.getByText('Fire extinguished.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save incident record' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Damage assessment')).not.toBeInTheDocument();
});

test('navigates to the analytics dashboard and filters back to matching records', async () => {
  apiRequest.mockResolvedValueOnce(analyticsCommandCenter);
  render(<IncidentRecords />);

  await screen.findByRole('heading', { name: 'FA-000012' });

  const sidebarNav = screen.getByRole('navigation', { name: 'Incident records sections' });
  fireEvent.click(within(sidebarNav).getByRole('button', { name: /Analytics Dashboard/i }));

  expect(screen.getByRole('heading', { name: 'Incident Analytics Dashboard' })).toBeInTheDocument();
  const detailedKpis = screen.getByLabelText('Detailed incident analytics');
  expect(within(detailedKpis).getAllByText('50%').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Brgy. B. Del Mundo')).toBeInTheDocument();
  expect(screen.getAllByText('8 min').length).toBeGreaterThanOrEqual(1);

  fireEvent.click(screen.getByRole('button', { name: /Brgy\. B\. Del Mundo/i }));

  expect(screen.getByRole('heading', { name: 'Incident Records' })).toBeInTheDocument();
  expect(screen.getByText('1 records')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'FA-000012' })).toBeInTheDocument();
});

test('filters the incident data table by location and date range, edits via modal, and inspects dispatch logs', async () => {
  apiRequest
    .mockResolvedValueOnce(analyticsCommandCenter)
    .mockResolvedValueOnce({ data: null, message: 'Incident record updated' })
    .mockResolvedValueOnce({
      data: {
        ...analyticsCommandCenter.data,
        reports: analyticsCommandCenter.data.reports.map((r) => (
          r.id === 12
            ? {
              ...r,
              incidentRecord: {
                ...r.incidentRecord,
                damage_assessment: 'Updated roof and kitchen damage.',
              },
            }
            : r
        )),
      },
    });
  render(<IncidentRecords />);

  await screen.findByRole('heading', { name: 'FA-000012' });

  // Already-saved FA-000012 is read-only inside Incident Records view
  expect(screen.getByText('Saved · Read-only')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save incident record' })).not.toBeInTheDocument();

  const sidebarNav = screen.getByRole('navigation', { name: 'Incident records sections' });
  fireEvent.click(within(sidebarNav).getByRole('button', { name: /Incident Data Table/i }));

  expect(screen.getByRole('heading', { name: 'Incident Data Table' })).toBeInTheDocument();
  expect(screen.getByText('Lester Jhon')).toBeInTheDocument();
  expect(screen.getByText('Engine 01')).toBeInTheDocument();
  expect(screen.getByText('FO1 Santos')).toBeInTheDocument();
  expect(screen.getByText('Roof partially burned.')).toBeInTheDocument();
  expect(screen.getByText('Fire contained and overhauled.')).toBeInTheDocument();

  // Filter by location (Brgy. Balugo -> only FA-000011)
  fireEvent.change(screen.getByLabelText('Filter by location'), {
    target: { value: 'Brgy. Balugo' },
  });
  expect(screen.getByText('FA-000011')).toBeInTheDocument();
  expect(screen.queryByText('FA-000012')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByText('FA-000012')).toBeInTheDocument();
  expect(screen.getByText('FA-000011')).toBeInTheDocument();

  // Filter by date range (from 2026-11-12 -> only FA-000012)
  fireEvent.change(screen.getByLabelText('Date from'), {
    target: { value: '2026-11-12' },
  });
  expect(screen.getByText('FA-000012')).toBeInTheDocument();
  expect(screen.queryByText('FA-000011')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));

  // Edit record inside Data Table via modal (first row = FA-000012)
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit record' })[0]);
  const modal = await screen.findByRole('dialog');
  expect(within(modal).getByRole('heading', { name: /Edit Incident Record · FA-000012/i })).toBeInTheDocument();
  fireEvent.change(within(modal).getByLabelText('Damage assessment'), {
    target: { value: 'Updated roof and kitchen damage.' },
  });
  fireEvent.click(within(modal).getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/12/incident-record', expect.objectContaining({
    method: 'PUT',
    body: JSON.stringify({
      damage_assessment: 'Updated roof and kitchen damage.',
      casualties_count: 2,
      resolution_summary: 'Fire contained and overhauled.',
    }),
  })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('Updated roof and kitchen damage.')).toBeInTheDocument();

  fireEvent.click(within(sidebarNav).getByRole('button', { name: /Dispatches & Units/i }));
  expect(screen.getByRole('heading', { name: 'Dispatches & Response Units' })).toBeInTheDocument();
  expect(screen.getAllByText('Engine 01').length).toBeGreaterThan(0);
  expect(screen.getAllByText('FO1 Santos').length).toBeGreaterThan(0);
  expect(screen.getByText('B-104')).toBeInTheDocument();
});

test('places High-Risk Predictions second in sidebar and shows user and firetruck management for admin users', async () => {
  apiRequest.mockImplementation((path) => {
    if (path === '/command-center') return Promise.resolve(analyticsCommandCenter);
    if (path === '/admin/dashboard') {
      return Promise.resolve({
        data: {
          users: [],
          firetrucks: [],
          login_attempt_settings: { max_attempts: 5, lockout_minutes: 15 },
        },
      });
    }
    if (path.startsWith('/admin/high-risk-areas')) {
      const sample = {
        barangay_name: 'Panaytayan',
        latitude: 12.5427,
        longitude: 121.3334,
        reference_risk_level: 'High',
        predicted_risk_level: 'High',
        predicted_risk_score: 82,
        historical: { available: false, incident_count: 0 },
      };
      return Promise.resolve({
        data: {
          model_available: true,
          methodology: 'Weather + history.',
          daily_predictions: [sample],
          high_risk_locations: [sample],
          forecast_days: [],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });

  render(<IncidentRecords user={{ id: 1, name: 'BFPAdmin', role: 'admin' }} />);
  await screen.findByRole('heading', { name: 'FA-000012' });

  const sidebarNav = screen.getByRole('navigation', { name: 'Incident records sections' });
  const navLabels = within(sidebarNav)
    .getAllByRole('button')
    .map((btn) => btn.querySelector('.bfp-records-nav-label')?.textContent);

  expect(navLabels).toEqual([
    'Incident Records',
    'High-Risk Predictions',
    'Analytics Dashboard',
    'Incident Data Table',
    'Dispatches & Units',
    'User Management',
    'Firetruck Management',
  ]);

  fireEvent.click(within(sidebarNav).getByRole('button', { name: /High-Risk Predictions/i }));
  expect(await screen.findByRole('heading', { name: /Daily & 7-Day Fire Risk Prediction/i })).toBeInTheDocument();

  fireEvent.click(within(sidebarNav).getByRole('button', { name: /User Management/i }));
  expect(await screen.findByRole('heading', { name: 'Add account' })).toBeInTheDocument();

  fireEvent.click(within(sidebarNav).getByRole('button', { name: /Firetruck Management/i }));
  expect(await screen.findByRole('heading', { name: 'Add firetruck' })).toBeInTheDocument();
});

test('removes System Admin from top navbar and embeds admin sections in Incident Records for admin user', async () => {
  apiRequest.mockImplementation((path) => {
    if (path === '/command-center') return Promise.resolve(analyticsCommandCenter);
    if (path === '/admin/dashboard') {
      return Promise.resolve({
        data: { users: [], firetrucks: [], login_attempt_settings: { max_attempts: 5, lockout_minutes: 15 } },
      });
    }
    return Promise.resolve({ data: {} });
  });

  render(<BFPShell user={{ id: 1, name: 'BFPAdmin', role: 'admin' }} onLogout={jest.fn()} />);

  expect(screen.getByRole('button', { name: /Command Center/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Incident Records/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /System Admin/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Incident Records/i }));
  expect(await screen.findByRole('heading', { name: 'FA-000012' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /High-Risk Predictions/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /User Management/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Firetruck Management/i })).toBeInTheDocument();
});
