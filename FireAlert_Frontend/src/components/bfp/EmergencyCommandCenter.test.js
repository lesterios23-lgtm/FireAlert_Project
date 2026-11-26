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

test('single modal transitions from Report Request (Receive) to Dispatch (En Route) to auto-Arrived to Incident Record resolution', async () => {
  let currentStatus = 'pending';
  let currentDispatch = null;
  let currentRecord = null;

  const originalGeolocation = navigator.geolocation;
  let watchSuccess = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: jest.fn((success) => {
        watchSuccess = success;
        return 1;
      }),
      clearWatch: jest.fn(),
    },
  });

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
        incidentRecord: currentRecord,
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
        { status_id: 4, status_name: 'Arrived' },
        { status_id: 5, status_name: 'Resolved' },
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
    if (path === '/reports/42/dispatch-location' && options?.method === 'POST') {
      const parsed = JSON.parse(options.body);
      if (parsed.arrived) {
        currentStatus = 'arrived';
        currentDispatch = {
          ...currentDispatch,
          arrived_at: '2026-11-04T10:12:00Z',
        };
      }
      return Promise.resolve({
        status: 200,
        data: {
          dispatch: currentDispatch,
          auto_arrived: Boolean(parsed.arrived),
          status: currentStatus,
        },
      });
    }
    if (path === '/reports/42/incident-record' && options?.method === 'PUT') {
      currentRecord = JSON.parse(options.body);
      return Promise.resolve({ status: 200 });
    }
    return Promise.resolve(makeCommandCenter());
  });

  try {
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

    // Stage 3 (En Route): Dispatch Info inside the SAME modal; resolve button not shown until Arrived
    expect(await within(dialog).findByText(/Current response unit/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Engine 1 · Duty Officer/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Incident Resolved/i })).not.toBeInTheDocument();

    // Simulate responder stopping within meters of the incident location for 10s -> automatic Arrived
    jest.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: /Start live GPS tracking/i }));
    await act(async () => {
      watchSuccess({
        coords: { latitude: 12.4, longitude: 121.44, accuracy: 8 },
        timestamp: Date.now(),
      });
      await Promise.resolve();
    });
    expect(within(dialog).getByText(/Within arrival range/i)).toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });
    jest.useRealTimers();

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/42/dispatch-location', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"arrived":true'),
    })));

    // Now in Arrived state: Incident record form appears and must be filled before clicking Incident Resolved
    const damageField = await within(dialog).findByLabelText(/Damage assessment/i);
    const casualtiesField = within(dialog).getByLabelText(/Casualties count/i);
    const summaryField = within(dialog).getByLabelText(/Resolution summary/i);
    const resolveButton = within(dialog).getByRole('button', { name: /^Incident Resolved$/i });
    expect(resolveButton).toBeDisabled();

    fireEvent.change(damageField, { target: { value: 'Kitchen wall scorched' } });
    fireEvent.change(casualtiesField, { target: { value: '0' } });
    fireEvent.change(summaryField, { target: { value: 'Fire extinguished and scene cleared.' } });
    expect(resolveButton).not.toBeDisabled();

    fireEvent.click(resolveButton);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/42/incident-record', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        damage_assessment: 'Kitchen wall scorched',
        casualties_count: 0,
        resolution_summary: 'Fire extinguished and scene cleared.',
      }),
    })));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/reports/42', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'fire_report',
          attributes: { status: 'resolved' },
        },
      }),
    })));

    // Saved record is shown in Resolved state and only ONE modal dialog is ever rendered
    expect(await within(dialog).findByText(/Kitchen wall scorched/i)).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  } finally {
    jest.useRealTimers();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  }
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

test('automatically loads and displays incident photo evidence when opening a report without clicking a toggle button', async () => {
  const originalFetch = global.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    blob: () => Promise.resolve(mockBlob),
  }));
  URL.createObjectURL = jest.fn(() => 'blob:mock-evidence-url');
  URL.revokeObjectURL = jest.fn();

  try {
    apiRequest.mockImplementation((path) => {
      if (path === '/incidents') return Promise.resolve({ data: { incidents: [] } });
      return Promise.resolve({
        data: {
          reports: [{
            id: 55,
            attributes: {
              incidentAddress: 'Brgy. Poblacion',
              incidentDescription: 'Smoke visible.',
              status: 'pending',
              reportedAt: '2026-11-04T10:00:00Z',
              latitude: 12.4,
              longitude: 121.44,
              hasEvidence: true,
            },
            includes: { resident: { attributes: { name: 'Resident 55' } } },
          }],
          trucks: [],
          personnel: [],
          statuses: [{ status_id: 1, status_name: 'Submitted' }],
        },
      });
    });

    const { unmount } = render(<EmergencyCommandCenter />);

    fireEvent.click(await screen.findByTestId('map-pin-55'));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByRole('button', { name: /View incident photo evidence/i })).not.toBeInTheDocument();
    const img = await within(dialog).findByAltText('Submitted incident evidence');
    expect(img).toHaveAttribute('src', 'blob:mock-evidence-url');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/reports\/55\/evidence$/),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-evidence-url');
  } finally {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
