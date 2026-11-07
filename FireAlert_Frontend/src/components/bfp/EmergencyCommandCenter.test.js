import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmergencyCommandCenter from './EmergencyCommandCenter';
import { apiRequest } from '../../sharedApi';

jest.mock('../shared/MapContainer', () => function MockMapContainer() {
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
  apiRequest.mockResolvedValue({ data: { reports: [], trucks: [], personnel: [], statuses: [] } });

  await act(async () => {
    render(<EmergencyCommandCenter />);
    await Promise.resolve();
  });
  expect(apiRequest).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(12000);
    await Promise.resolve();
  });
  expect(apiRequest).toHaveBeenCalledTimes(2);
  expect(apiRequest).toHaveBeenLastCalledWith('/command-center');
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
  apiRequest.mockResolvedValueOnce(commandCenter).mockResolvedValueOnce(commandCenter);
  render(<EmergencyCommandCenter />);

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
