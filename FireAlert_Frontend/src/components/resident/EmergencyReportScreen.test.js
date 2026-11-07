import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmergencyReportScreen from './EmergencyReportScreen';

jest.mock('../shared/MapContainer', () => function MockMapContainer({ onLocationSelect }) {
  return (
    <button
      type='button'
      onClick={() => onLocationSelect?.({ latitude: 12.3952, longitude: 121.4355 })}
    >
      Select map location
    </button>
  );
});

const createdReport = {
  data: {
    type: 'fire_report',
    id: 'report-42',
    attributes: {
      incidentAddress: 'Public Market, Brgy. Poblacion',
      incidentDescription: 'Smoke near the entrance.',
      latitude: 12.3952,
      longitude: 121.4355,
      locationSource: 'manual',
      status: 'pending',
      reportedAt: '2026-11-04T10:00:00Z',
    },
  },
};

function mockCreateReport(response = { ok: true, json: async () => createdReport }) {
  global.fetch = jest.fn().mockResolvedValue(response);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('firealert_token', 'resident-test-token');
  mockCreateReport();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('selects a manual map location and submits the report with coordinates', async () => {
  const onReportSubmitted = jest.fn();
  render(<EmergencyReportScreen onReportSubmitted={onReportSubmitted} />);

  fireEvent.change(screen.getByLabelText(/Address or landmark/i), {
    target: { value: 'Public Market, Brgy. Poblacion' },
  });
  fireEvent.change(screen.getByLabelText(/Incident description/i), {
    target: { value: 'Smoke near the entrance.' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Select map location/i }));

  expect(screen.getByText(/Selected location: 12\.39520, 121\.43550/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Large/i }));
  fireEvent.change(screen.getByLabelText(/Landmark or access notes/i), {
    target: { value: 'Use the main entrance.' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Submit emergency report/i }));
    await waitFor(() => expect(onReportSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'report-42', status: 'pending' })
    ));
  });

  const requestBody = global.fetch.mock.calls[0][1].body;
  expect(requestBody).toBeInstanceOf(FormData);
  const request = JSON.parse(requestBody.get('data'));
  expect(global.fetch.mock.calls[0][0]).toMatch(/\/reports$/);
  expect(request).toHaveProperty('type', 'fire_report');
  expect(request).not.toHaveProperty('data');
  expect(request.attributes).toEqual(expect.objectContaining({
    incidentAddress: 'Public Market, Brgy. Poblacion',
    latitude: 12.3952,
    longitude: 121.4355,
    locationSource: 'manual',
  }));
  expect(request.attributes.incidentDescription).toContain('Estimated fire size: large.');
  expect(request.attributes.incidentDescription).toContain('Access notes: Use the main entrance.');
});

test('previews and uploads optional photo evidence with the report', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:incident-evidence');
  URL.revokeObjectURL = jest.fn();
  const onReportSubmitted = jest.fn();
  const photo = new File(['evidence'], 'incident.jpg', { type: 'image/jpeg' });
  render(<EmergencyReportScreen onReportSubmitted={onReportSubmitted} />);

  fireEvent.change(screen.getByLabelText(/Address or landmark/i), {
    target: { value: 'Public Market, Brgy. Poblacion' },
  });
  fireEvent.change(screen.getByLabelText(/Incident description/i), {
    target: { value: 'Smoke near the entrance.' },
  });
  fireEvent.change(screen.getByLabelText(/Incident photo evidence/i), {
    target: { files: [photo] },
  });

  expect(await screen.findByAltText(/Selected incident evidence preview/i)).toHaveAttribute(
    'src',
    'blob:incident-evidence'
  );
  fireEvent.click(screen.getByRole('button', { name: /Submit emergency report/i }));

  await waitFor(() => expect(onReportSubmitted).toHaveBeenCalled());
  const requestBody = global.fetch.mock.calls[0][1].body;
  expect(requestBody.get('evidencePhoto')).toBe(photo);
  expect(JSON.parse(requestBody.get('data')).attributes.incidentDescription)
    .toContain('Estimated fire size: medium.');
});

test('uses browser geolocation when available', async () => {
  const getCurrentPosition = jest.fn((success) => success({
    coords: { latitude: 12.4, longitude: 121.44 },
  }));
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });

  render(<EmergencyReportScreen onReportSubmitted={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Use my location/i }));

  expect(getCurrentPosition).toHaveBeenCalled();
  expect(await screen.findByText(/Selected location: 12\.40000, 121\.44000/i)).toBeInTheDocument();
  expect(screen.getByDisplayValue('Current device location')).toBeInTheDocument();
});

test('allows placing the incident pin manually when device location is denied', async () => {
  const getCurrentPosition = jest.fn((success, error) => error({
    code: 1,
    message: 'User denied Geolocation',
  }));
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });

  render(<EmergencyReportScreen onReportSubmitted={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Use my location/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/tap the map to place the pin manually/i);
  fireEvent.click(screen.getByRole('button', { name: /Select map location/i }));

  expect(screen.getByText(/Selected location: 12\.39520, 121\.43550/i)).toBeInTheDocument();
});

test('shows API validation errors and stays on the form when a report is rejected', async () => {
  mockCreateReport({
    ok: false,
    status: 422,
    json: async () => ({
      message: 'The incident address field is required.',
      errors: { incidentAddress: ['The incident address field is required.'] },
    }),
  });

  render(<EmergencyReportScreen onReportSubmitted={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Address or landmark/i), {
    target: { value: 'Public Market, Brgy. Poblacion' },
  });
  fireEvent.change(screen.getByLabelText(/Incident description/i), {
    target: { value: 'Smoke near the entrance.' },
  });
  const form = screen.getByRole('button', { name: /Submit emergency report/i }).closest('form');
  await act(async () => {
    fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(/incident address field is required/i);
  expect(screen.getByRole('heading', { name: /Report a fire/i })).toBeInTheDocument();
});

test('does not submit without the required incident description', () => {
  render(<EmergencyReportScreen onReportSubmitted={jest.fn()} />);

  const form = screen.getByRole('button', { name: /Submit emergency report/i }).closest('form');
  fireEvent.submit(form);

  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(/describe what is happening/i);
});
