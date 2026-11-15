import {
  buildFirePinIcon,
  buildResponderPinIcon,
  buildStationPinIcon,
  coordinatesOf,
  hasGoogleMapsKey,
  routeCoordinates,
} from './googleMaps';

test('builds data-URI marker artwork for the map pins', () => {
  const fire = buildFirePinIcon();
  const active = buildFirePinIcon(true);
  const station = buildStationPinIcon();
  const responder = buildResponderPinIcon();

  expect(fire.url).toContain('data:image/svg+xml');
  expect(fire.url).toContain('e44335');
  expect(active.url).toContain('b5121f');
  expect(station.url).toContain('BFP');
  expect(responder.url).toContain('%F0%9F%9A%92');
  expect(fire.scaledSize).toEqual({ width: 32, height: 40 });
  expect(responder.anchor).toEqual({ x: 21, y: 21 });
});

test('reads the Google Maps key from the environment', () => {
  expect(hasGoogleMapsKey()).toBe(Boolean(process.env.REACT_APP_GOOGLE_MAPS_API_KEY));
});

test('normalizes map coordinates and route points', () => {
  expect(coordinatesOf({ latitude: '12.5', longitude: '121.4' })).toEqual({ lat: 12.5, lng: 121.4 });
  expect(coordinatesOf({ lat: 12.5, lng: 121.4 })).toEqual({ lat: 12.5, lng: 121.4 });
  expect(coordinatesOf({ latitude: 91, longitude: 121 })).toBeNull();
  expect(coordinatesOf(null)).toBeNull();

  expect(routeCoordinates([
    [12.522452, 121.442176],
    { latitude: 12.518, longitude: 121.438 },
    [null, null],
  ])).toEqual([
    { lat: 12.522452, lng: 121.442176 },
    { lat: 12.518, lng: 121.438 },
  ]);
  expect(routeCoordinates(null)).toEqual([]);
});
