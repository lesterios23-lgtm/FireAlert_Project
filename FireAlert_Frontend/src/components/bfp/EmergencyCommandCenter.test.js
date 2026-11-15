import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EmergencyCommandCenter from './EmergencyCommandCenter';
import { apiRequest } from '../../sharedApi';

jest.mock('../shared/GoogleMap', () => function MockGoogleMap() {
  return <div aria-label='Map' />;
});

jest.mock('../../sharedApi', () => ({
  ...jest.requireActual('../../sharedApi'),
  apiRequest: jest.fn(),
}));

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('refreshes BFP reports every 12 seconds', async () => {
  jest.useFakeTimers();
  apiRequest.mockImplementation((path) => {
    if (path === '/incidents') return Promise.resolve({ data: { incidents: [] } });
    return Promise.resolve({ data: { reports: [], trucks: [], personnel: [], statuses: [] } });
  });

  await act(async () => {
    render(<EmergencyCommandCenter />);
    await Promise.resolve();
  });
  expect(apiRequest).toHaveBeenCalledWith('/command-center');
  expect(apiRequest).toHaveBeenCalledWith('/incidents');

  const callsBefore = apiRequest.mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(12000);
    await Promise.resolve();
  });
  expect(apiRequest.mock.calls.length).toBe(callsBefore + 2);
  expect(apiRequest).toHaveBeenLastCalledWith('/incidents');
});

test('dispatches the selected incident with its truck, personnel, and ETA without a station selector', async () => {
  const commandCenter = {
    data: {
      reports: [{
        id: 42,
        attributes: {
          incidentAddress: 'Mansalay Public Market',
          incidentDescription: 'Smoke from a house.',
          status: 'pending',
          reportedAt: '2026-11-04T10:00:00Z',
          latitude: 12.4,
          longitude: 121.44,
        },
        includes: { resident: { attributes: { name: 'Resident' } } },
      }],
      trucks: [{ truck_id: 3, unit_name: 'Engine 1', status: 'Available' }],
      personnel: [
        { personnel_id: 4, user_id: 20, full_name: 'Duty Officer' },
        { personnel_id: null, user_id: 21, full_name: 'BFP Member Without Profile' },
      ],
      statuses: [{ status_id: 1, status_name: 'Submitted' }],
    },
  };
  apiRequest.mockImplementation((path) => {
    if (path === '/incidents') return Promise.resolve({ data: { incidents: [] } });
    return Promise.resolve(commandCenter);
  });
  render(<EmergencyCommandCenter />);

  // No grouped incidents yet: review the flat report list.
  fireEvent.click(await screen.findByRole('tab', { name: /All Reports/i }));
  await screen.findByRole('heading', { name: 'Mansalay Public Market' });
  expect(screen.queryByLabelText('BFP station')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: /BFP Member Without Profile.*Complete personnel profile/i })).toBeDisabled();
  await waitFor(() => expect(screen.getByLabelText(/Suggested arrival time/i)).toHaveValue(17));
  expect(screen.getByText(/13\.6 km straight-line distance at 50 km\/h/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Fire truck'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('BFP personnel'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(/Suggested arrival time/i), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm dispatch' }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/42/dispatch', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      truck_id: 3,
      personnel_id: 4,
      estimated_eta_minutes: 15,
    }),
  })));
});

test('groups supporting reports under one Main Incident with verify flags', async () => {
  const member = (id, flag) => ({
    id,
    attributes: {
      incidentAddress: `Purok 3, Brgy. Poblacion (${id})`,
      incidentDescription: 'House fire near the chapel.',
      status: 'pending',
      reportedAt: '2026-11-04T10:00:00Z',
      latitude: 12.4,
      longitude: 121.44,
      duplicateFlag: flag,
    },
    includes: { resident: { attributes: { name: `Resident ${id}` } } },
  });
  const commandCenter = {
    data: {
      reports: [member(42, 'anchor'), member(43, 'grouped'), member(44, 'possible')],
      trucks: [],
      personnel: [],
      statuses: [],
    },
  };
  const incidents = {
    data: {
      incidents: [{
        id: 7,
        attributes: {
          code: 'INC-001',
          incidentAddress: 'Purok 3, Brgy. Poblacion',
          incidentDescription: 'House fire near the chapel.',
          status: 'pending',
          firstReportedAt: '2026-11-04T10:00:00Z',
          lastReportedAt: '2026-11-04T10:05:00Z',
          reportCount: 3,
          possibleDuplicates: [44],
          reports: [member(42, 'anchor'), member(43, 'grouped'), member(44, 'possible')],
        },
      }],
    },
  };
  apiRequest.mockImplementation((path) => Promise.resolve(path === '/incidents' ? incidents : commandCenter));
  render(<EmergencyCommandCenter />);

  // Main Incidents tab shows one consolidated card with the report count.
  expect(await screen.findByRole('tab', { name: /Main Incidents \(1\)/i })).toBeInTheDocument();
  expect(screen.getByText('INC-001')).toBeInTheDocument();
  expect(screen.getByText(/3 reports/i)).toBeInTheDocument();
  expect(screen.getByText(/1 possible duplicate.*need verification/i)).toBeInTheDocument();

  // Opening the incident lists every supporting report with duplicate flags.
  fireEvent.click(screen.getByText('INC-001'));
  expect(await screen.findByText(/Supporting reports \(3\)/i)).toBeInTheDocument();
  expect(screen.getByText('First report')).toBeInTheDocument();
  expect(screen.getByText('Grouped report')).toBeInTheDocument();
  expect(screen.getByText('Possible duplicate — verify')).toBeInTheDocument();

  // Switching to All Reports still shows every individual submission.
  fireEvent.click(screen.getByRole('tab', { name: /All Reports \(3\)/i }));
  const feedLists = document.querySelectorAll('.bfp-alert-list');
  const flatFeed = feedLists[feedLists.length - 1];
  const flatFeedScope = within(flatFeed);
  expect(flatFeedScope.getByText('Purok 3, Brgy. Poblacion (42)')).toBeInTheDocument();
  expect(flatFeedScope.getByText('Purok 3, Brgy. Poblacion (44)')).toBeInTheDocument();
});

test('updates the whole Main Incident status instead of one report', async () => {
  const member = {
    id: 42,
    attributes: {
      incidentAddress: 'Purok 3, Brgy. Poblacion',
      incidentDescription: 'House fire.',
      status: 'pending',
      reportedAt: '2026-11-04T10:00:00Z',
    },
  };
  const commandCenter = { data: { reports: [member], trucks: [], personnel: [], statuses: [{ status_id: 3, status_name: 'En Route' }, { status_id: 1, status_name: 'Submitted' }] } };
  const incidents = {
    data: {
      incidents: [{
        id: 7,
        attributes: {
          code: 'INC-001',
          incidentAddress: 'Purok 3, Brgy. Poblacion',
          incidentDescription: 'House fire.',
          status: 'pending',
          firstReportedAt: '2026-11-04T10:00:00Z',
          lastReportedAt: '2026-11-04T10:00:00Z',
          reportCount: 1,
          possibleDuplicates: [],
          reports: [member],
        },
      }],
    },
  };
  apiRequest.mockImplementation((path) => Promise.resolve(path === '/incidents' ? incidents : commandCenter));
  render(<EmergencyCommandCenter />);

  fireEvent.click(await screen.findByText('INC-001'));
  expect(await screen.findByText(/Coordinating INC-001 \(1 reports\)/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /Main Incidents/i }));
  fireEvent.click(screen.getByText('INC-001'));
  const statusSelect = await screen.findByLabelText(/Response status.*whole Main Incident/i);
  fireEvent.change(statusSelect, { target: { value: 'responding' } });
  fireEvent.click(screen.getByRole('button', { name: /Update response status/i }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/incidents/7/status', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ status: 'responding' }),
  })));
});
