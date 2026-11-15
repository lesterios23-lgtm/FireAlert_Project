import {
  buildFallbackRoute,
  buildGoogleMapsDirectionsUrl,
  buildRouteUrl,
  clearRouteCache,
  describeStep,
  estimatedArrivalClock,
  fetchDrivingRoutes,
  formatDistanceKm,
  formatDurationMinutes,
  haversineDistanceKm,
  normalizeRoute,
  routeSourceLabel,
  validPoint,
} from './routeNavigation';

const ORIGIN = { latitude: 12.522452, longitude: 121.442176 };
const DESTINATION = { latitude: 12.518, longitude: 121.438 };

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
            {
              distance: 400,
              duration: 80,
              name: 'National Road',
              maneuver: { type: 'depart', modifier: 'right' },
            },
            {
              distance: 2050.5,
              duration: 340.8,
              name: 'Poblacion Road',
              maneuver: { type: 'turn', modifier: 'left' },
            },
            {
              distance: 0,
              duration: 0,
              name: '',
              maneuver: { type: 'arrive' },
            },
          ],
        },
      ],
    },
    {
      distance: 3100,
      duration: 510,
      geometry: {
        coordinates: [
          [121.442176, 12.522452],
          [121.446, 12.517],
          [121.438, 12.518],
        ],
      },
      legs: [{ steps: [] }],
    },
  ],
};

beforeEach(() => {
  clearRouteCache();
});

test('builds an OSRM driving URL with full GeoJSON geometry and steps', () => {
  const url = buildRouteUrl(ORIGIN, DESTINATION);

  expect(url).toContain('https://router.project-osrm.org/route/v1/driving/121.442176,12.522452;121.438,12.518');
  expect(url).toContain('overview=full');
  expect(url).toContain('geometries=geojson');
  expect(url).toContain('steps=true');
  expect(url).toContain('alternatives=true');
});

test('normalizes an OSRM route into map points, stats, and instructions', () => {
  const route = normalizeRoute(osrmPayload.routes[0]);

  expect(route.geometry).toEqual([
    [12.522452, 121.442176],
    [12.521, 121.441],
    [12.518, 121.438],
  ]);
  expect(route.distanceKm).toBeCloseTo(2.4505, 4);
  expect(route.durationMinutes).toBeCloseTo(7.013, 2);
  expect(route.source).toBe('osrm');
  expect(route.steps.map((step) => step.instruction)).toEqual([
    'Start on National Road',
    'Turn left onto Poblacion Road',
    'Arrive at the incident location',
  ]);
});

test('describes common OSRM maneuver types in plain language', () => {
  expect(describeStep({ name: 'Main Street', maneuver: { type: 'depart' } })).toBe('Start on Main Street');
  expect(describeStep({ name: 'Rizal Avenue', maneuver: { type: 'turn', modifier: 'sharp right' } })).toBe('Turn sharp right onto Rizal Avenue');
  expect(describeStep({ name: 'Market Road', maneuver: { type: 'merge', modifier: 'left' } })).toBe('Merge left onto Market Road');
  expect(describeStep({ name: 'Town Plaza', maneuver: { type: 'roundabout', exit: 2 } })).toBe('Take the roundabout and take exit 2 onto Town Plaza');
  expect(describeStep({ maneuver: { type: 'arrive' } })).toBe('Arrive at the incident location');
});

test('fetches every returned alternative and caches the successful result', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => osrmPayload,
  });

  const routes = await fetchDrivingRoutes(ORIGIN, DESTINATION, { fetchImpl });

  expect(routes).toHaveLength(2);
  expect(routes[0].source).toBe('osrm');
  expect(fetchImpl).toHaveBeenCalledTimes(1);

  const cached = await fetchDrivingRoutes(ORIGIN, DESTINATION, { fetchImpl });
  expect(cached).toHaveLength(2);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('falls back to a straight-line estimate when routing is unavailable', async () => {
  const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));

  const routes = await fetchDrivingRoutes(ORIGIN, DESTINATION, { fetchImpl });
  const fallback = routes[0];

  expect(fallback.source).toBe('estimated');
  expect(fallback.geometry).toEqual([
    [12.522452, 121.442176],
    [12.518, 121.438],
  ]);
  expect(fallback.distanceKm).toBeCloseTo(haversineDistanceKm(ORIGIN, DESTINATION), 5);
  expect(fallback.durationMinutes).toBeCloseTo((fallback.distanceKm / 50) * 60, 5);
  expect(routes[0].steps[1].instruction).toContain('incident location');
});

test('falls back when the routing service returns a non-OK payload', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 'NoRoute', routes: [] }),
  });

  const routes = await fetchDrivingRoutes(ORIGIN, DESTINATION, { fetchImpl });

  expect(routes[0].source).toBe('estimated');
});

test('rejects missing and out-of-range coordinates', () => {
  expect(validPoint(null)).toBeNull();
  expect(validPoint({ latitude: 91, longitude: 121 })).toBeNull();
  expect(validPoint({ latitude: 12, longitude: 181 })).toBeNull();
  expect(validPoint({ lat: '12.5', lng: '121.4' })).toEqual({ latitude: 12.5, longitude: 121.4 });
  expect(buildRouteUrl(null, DESTINATION)).toBeNull();
  expect(buildFallbackRoute(ORIGIN, null)).toBeNull();
});

test('sorts out display values and external navigation links', () => {
  expect(formatDistanceKm(0.24)).toBe('240 m');
  expect(formatDistanceKm(2.45)).toBe('2.5 km');
  expect(formatDistanceKm(14.6)).toBe('15 km');
  expect(formatDurationMinutes(0.4)).toBe('1 min');
  expect(formatDurationMinutes(75)).toBe('1 hr 15 min');
  expect(formatDurationMinutes(120)).toBe('2 hr');
  expect(routeSourceLabel({ source: 'osrm' })).toBe('Road route');
  expect(routeSourceLabel({ source: 'estimated' })).toBe('Estimated route');

  const arrival = estimatedArrivalClock(20, new Date('2026-11-15T08:00:00Z'));
  expect(arrival).toMatch(/\d/);

  const mapsUrl = buildGoogleMapsDirectionsUrl(ORIGIN, DESTINATION);
  expect(mapsUrl).toContain('https://www.google.com/maps/dir/?');
  expect(mapsUrl).toContain('origin=12.522452%2C121.442176');
  expect(mapsUrl).toContain('destination=12.518%2C121.438');
  expect(mapsUrl).toContain('travelmode=driving');
});
