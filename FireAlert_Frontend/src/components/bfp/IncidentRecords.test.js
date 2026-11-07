import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IncidentRecords from './IncidentRecords';
import { apiRequest } from '../../sharedApi';

jest.mock('../shared/MapContainer', () => function MockMapContainer() {
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
