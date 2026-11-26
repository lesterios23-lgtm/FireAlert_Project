import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import IncidentRecords from './IncidentRecords';
import { apiRequest } from '../../sharedApi';

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

test('loads incident records from command center data and saves the selected report record', async () => {
  apiRequest
    .mockResolvedValueOnce(commandCenter)
    .mockResolvedValueOnce({ data: null, message: 'Incident record saved' })
    .mockResolvedValueOnce(commandCenter);
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

test('filters the incident data table by location and date range and inspects dispatch logs', async () => {
  apiRequest.mockResolvedValueOnce(analyticsCommandCenter);
  render(<IncidentRecords />);

  await screen.findByRole('heading', { name: 'FA-000012' });

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

  // Jump from table row to Incident Records editor for FA-000011
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit record' })[1]);
  expect(screen.getByRole('heading', { name: 'FA-000011' })).toBeInTheDocument();

  fireEvent.click(within(sidebarNav).getByRole('button', { name: /Dispatches & Units/i }));
  expect(screen.getByRole('heading', { name: 'Dispatches & Response Units' })).toBeInTheDocument();
  expect(screen.getAllByText('Engine 01').length).toBeGreaterThan(0);
  expect(screen.getAllByText('FO1 Santos').length).toBeGreaterThan(0);
  expect(screen.getByText('B-104')).toBeInTheDocument();
});
