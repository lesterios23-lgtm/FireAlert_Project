import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EmergencyCommandCenter from './EmergencyCommandCenter';
import { apiRequest } from '../../sharedApi';

jest.mock('../shared/GoogleMap', () => function MockGoogleMap({ markers = [], onMarkerClick }) {
  return (
    <div aria-label='Map'>
      {markers.map((marker) => (
        <button
          key={marker.id}
          type='button'
          data-testid={`map-pin-${marker.id}`}
          onClick={() => onMarkerClick?.(marker)}
        >
          Pin {marker.address}
        </button>
      ))}
    </div>
  );
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

test('single modal transitions from Report Request (Receive) to Dispatch (En Route) to Dispatch Info without ETA input or status dropdown', async () => {
  let currentStatus = 'pending';
  let currentDispatch = null;

  const makeCommandCenter = () => ({
    data: {
      reports: [{
        id: 42,
        attributes: {
          incidentAddress: 'Mansalay Public Market',
          incidentDescription: 'Smoke from a house.',
          status: currentStatus,
          reportedAt: '2026-11-04T10:00:00Z',
          latitude: 12.4,
          longitude: 121.44,
        },
        dispatch: currentDispatch,
        includes: { resident: { attributes: { name: 'Resident' } } },
      }],
      trucks: [{ truck_id: 3, unit_name: 'Engine 1', status: 'Available' }],
      personnel: [
        { personnel_id: 4, user_id: 20, full_name: 'Duty Officer' },
        { personnel_id: null, user_id: 21, full_name: 'BFP Member Without Profile' },
      ],
      statuses: [
        { status_id: 1, status_name: 'Submitted' },
        { status_id: 2, status_name: 'Received' },
        { status_id: 3, status_name: 'En Route' },
      ],
    },
  });

  apiRequest.mockImplementation((path, options) => {
    if (path === '/incidents') return Promise.resolve({ data: { incidents: [] } });
    if (path === '/reports/42' && options?.method === 'PATCH') {
      const parsed = JSON.parse(options.body);
      currentStatus = parsed.data.attributes.status;
      return Promise.resolve({ status: 200 });
    }
    if (path === '/reports/42/dispatch' && options?.method === 'POST') {
      currentStatus = 'responding';
      currentDispatch = {
        report_id: 42,
        unit_name: 'Engine 1',
        personnel_name: 'Duty Officer',
        estimated_eta_minutes: 17,
      };
      return Promise.resolve({ status: 200 });
    }
    return Promise.resolve(makeCommandCenter());
  });

  render(<EmergencyCommandCenter />);

  // Click the pin on the map to open the single modal
  const pinButton = await screen.findByTestId('map-pin-42');
  fireEvent.click(pinButton);

  // Stage 1: Report Request Info + Receive button (no status dropdown, no ETA input)
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'Mansalay Public Market' })).toBeInTheDocument();
  expect(within(dialog).queryByLabelText(/Response status/i)).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText(/Suggested arrival time/i)).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: /Receive Report/i }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/42', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'fire_report',
        attributes: { status: 'accepted' },
      },
    }),
  })));

  // Stage 2: Dispatch Fill-up inside the SAME modal (Fire truck + BFP personnel, no ETA input)
  const truckSelect = await within(dialog).findByLabelText('Fire truck');
  expect(within(dialog).queryByLabelText(/Suggested arrival time/i)).not.toBeInTheDocument();
  expect(within(dialog).getByRole('option', { name: /BFP Member Without Profile.*Complete personnel profile/i })).toBeDisabled();

  fireEvent.change(truckSelect, { target: { value: '3' } });
  fireEvent.change(within(dialog).getByLabelText('BFP personnel'), { target: { value: '4' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /^En Route$/i }));

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/42/dispatch', expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('"truck_id":3'),
  })));

  // Stage 3: Dispatch Info inside the SAME modal
  expect(await within(dialog).findByText(/Current response unit/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/Engine 1 · Duty Officer/i)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /Mark Incident Resolved/i })).toBeInTheDocument();
  // Ensure only ONE modal dialog is ever rendered
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
});

test('groups supporting reports under one Main Incident with verify flags and receives whole incident', async () => {
  let incidentStatus = 'pending';
  const member = (id, flag) => ({
    id,
    attributes: {
      incidentAddress: `Purok 3, Brgy. Poblacion (${id})`,
      incidentDescription: 'House fire near the chapel.',
      status: incidentStatus,
      reportedAt: '2026-11-04T10:00:00Z',
      latitude: 12.4,
      longitude: 121.44,
      duplicateFlag: flag,
    },
    includes: { resident: { attributes: { name: `Resident ${id}` } } },
  });
  const makeCommandCenter = () => ({
    data: {
      reports: [member(42, 'anchor'), member(43, 'grouped'), member(44, 'possible')],
      trucks: [{ truck_id: 3, unit_name: 'Engine 1', status: 'Available' }],
      personnel: [{ personnel_id: 4, user_id: 20, full_name: 'Duty Officer' }],
      statuses: [{ status_id: 1, status_name: 'Submitted' }],
    },
  });
  const makeIncidents = () => ({
    data: {
      incidents: [{
        id: 7,
        attributes: {
          code: 'INC-001',
          incidentAddress: 'Purok 3, Brgy. Poblacion',
          incidentDescription: 'House fire near the chapel.',
          status: incidentStatus,
          firstReportedAt: '2026-11-04T10:00:00Z',
          lastReportedAt: '2026-11-04T10:05:00Z',
          reportCount: 3,
          possibleDuplicates: [44],
          reports: [member(42, 'anchor'), member(43, 'grouped'), member(44, 'possible')],
        },
      }],
    },
  });

  apiRequest.mockImplementation((path, options) => {
    if (path === '/incidents') return Promise.resolve(makeIncidents());
    if (path === '/incidents/7/status' && options?.method === 'PATCH') {
      incidentStatus = JSON.parse(options.body).status;
      return Promise.resolve({ status: 200 });
    }
    return Promise.resolve(makeCommandCenter());
  });

  render(<EmergencyCommandCenter />);

  // Main Incidents tab in floating sidebar shows one consolidated card with the report count.
  expect(await screen.findByRole('tab', { name: /Main Incidents \(1\)/i })).toBeInTheDocument();
  expect(screen.getByText('INC-001')).toBeInTheDocument();
  expect(screen.getByText(/3 reports/i)).toBeInTheDocument();
  expect(screen.getByText(/1 possible duplicate.*need verification/i)).toBeInTheDocument();

  // Clicking the map pin opens the single modal with supporting reports and Receive button
  fireEvent.click(screen.getByTestId('map-pin-42'));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/Supporting reports \(3\)/i)).toBeInTheDocument();
  expect(within(dialog).getByText('First report')).toBeInTheDocument();
  expect(within(dialog).getByText('Grouped report')).toBeInTheDocument();
  expect(within(dialog).getByText('Possible duplicate — verify')).toBeInTheDocument();

  // Receiving updates the whole Main Incident status to accepted
  fireEvent.click(within(dialog).getByRole('button', { name: /Receive Report/i }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/incidents/7/status', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  })));

  // Switching to All Reports in the sidebar still shows every individual submission.
  fireEvent.click(within(dialog).getByRole('button', { name: /Close modal/i }));
  fireEvent.click(screen.getByRole('tab', { name: /All Reports \(3\)/i }));
  const flatFeed = document.querySelector('.bfp-alert-list');
  const flatFeedScope = within(flatFeed);
  expect(flatFeedScope.getByText('Purok 3, Brgy. Poblacion (42)')).toBeInTheDocument();
  expect(flatFeedScope.getByText('Purok 3, Brgy. Poblacion (44)')).toBeInTheDocument();
});
