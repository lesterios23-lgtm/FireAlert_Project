import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RouteNavigationMap from './RouteNavigationMap';
import { clearRouteCache } from './routeNavigation';

jest.mock('./GoogleMap', () => function MockGoogleMap({ route, responder }) {
  return (
    <div
      aria-label='Map'
      data-route-points={route?.length || 0}
      data-responder={responder ? `${responder.latitude},${responder.longitude}` : ''}
    />
  );
});

const destination = { latitude: 12.518, longitude: 121.438 };
const osrmPayload = {
  code: 'Ok',
  routes: [
    {
      distance: 2450.5,
      duration: 420.8,
      geometry: {
        coordinates: [
          [121.442176, 12.522452],
          [121.441, 12.521],
          [121.438, 12.518],
        ],
      },
      legs: [
        {
          steps: [
            { distance: 400, duration: 80, name: 'National Road', maneuver: { type: 'depart' } },
            { distance: 2050.5, duration: 340.8, name: 'Poblacion Road', maneuver: { type: 'turn', modifier: 'left' } },
            { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive' } },
          ],
        },
      ],
    },
  ],
};

let originalFetch;
let originalGeolocation;

beforeEach(() => {
  clearRouteCache();
  originalFetch = global.fetch;
  originalGeolocation = navigator.geolocation;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => osrmPayload,
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: originalGeolocation,
  });
  jest.clearAllMocks();
});

test('shows the suggested road route, ETA, and turn-by-turn directions', async () => {
  render(<RouteNavigationMap destination={destination} />);

  expect(await screen.findByText('Road route')).toBeInTheDocument();
  expect(await screen.findByText(/2\.5 km · 8 min/)).toBeInTheDocument();
  expect(screen.getByText('Start on National Road')).toBeInTheDocument();
  expect(screen.getByText('Turn left onto Poblacion Road')).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-route-points', '3');
  expect(screen.getByRole('link', { name: /Open in Google Maps/i })).toBeInTheDocument();
});

test('falls back to an estimated straight-line route when road routing fails', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));

  render(<RouteNavigationMap destination={destination} />);

  expect(await screen.findByText('Estimated route')).toBeInTheDocument();
  expect(screen.getByText(/Road routing is unavailable right now/i)).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-route-points', '2');
});

test('explains when the incident has no map coordinates', () => {
  render(<RouteNavigationMap destination={{ latitude: null, longitude: null }} />);

  expect(screen.getByText(/Add an incident map pin or GPS coordinates/i)).toBeInTheDocument();
  expect(screen.queryByText('Road route')).not.toBeInTheDocument();
});

test('shows the dispatched unit live position in the resident view', async () => {
  render(
    <RouteNavigationMap
      destination={destination}
      existingResponder={{
        latitude: 12.52,
        longitude: 121.44,
        accuracyMeters: 12,
        updatedAt: '2026-11-15T08:00:00Z',
        unit_name: 'Engine 1',
      }}
      readOnly
    />
  );

  expect(await screen.findByText('Responder live position')).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-responder', '12.52,121.44');
  expect(screen.queryByRole('button', { name: /Start live GPS tracking/i })).not.toBeInTheDocument();
});

test('starts device GPS tracking and publishes the first fix', async () => {
  const watchPosition = jest.fn(() => 7);
  const clearWatch = jest.fn();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch },
  });
  const onShareLocation = jest.fn().mockResolvedValue({});

  const { unmount } = render(
    <RouteNavigationMap
      destination={destination}
      canTrack
      onShareLocation={onShareLocation}
    />
  );

  fireEvent.click(await screen.findByRole('button', { name: /Start live GPS tracking/i }));
  expect(watchPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({ enableHighAccuracy: true })
  );

  const onPosition = watchPosition.mock.calls[0][0];
  act(() => {
    onPosition({
      coords: { latitude: 12.521, longitude: 121.441, accuracy: 11 },
      timestamp: Date.now(),
    });
  });

  await waitFor(() => expect(onShareLocation).toHaveBeenCalledWith(expect.objectContaining({
    latitude: 12.521,
    longitude: 121.441,
    accuracy: 11,
  })));
  expect(await screen.findByText('Sharing live GPS position')).toBeInTheDocument();
  expect(screen.getByLabelText('Map')).toHaveAttribute('data-responder', '12.521,121.441');

  fireEvent.click(screen.getByRole('button', { name: /Stop GPS tracking/i }));
  expect(clearWatch).toHaveBeenCalledWith(7);
  unmount();
});

test('reports a denied GPS permission without stopping the map', async () => {
  const watchPosition = jest.fn((success, failure) => {
    failure({ code: 1 });
    return 9;
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch: jest.fn() },
  });

  render(<RouteNavigationMap destination={destination} canTrack />);

  fireEvent.click(await screen.findByRole('button', { name: /Start live GPS tracking/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Location permission was denied/i);
  expect(screen.getByLabelText('Map')).toBeInTheDocument();
});
