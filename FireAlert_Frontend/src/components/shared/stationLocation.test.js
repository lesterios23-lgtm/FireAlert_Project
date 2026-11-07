import {
  BFP_STATION_LOCATION,
  calculateStationDistanceKm,
  suggestArrivalMinutes,
} from './stationLocation';

test('uses the permanent Mansalay station coordinates', () => {
  expect(BFP_STATION_LOCATION).toEqual({
    latitude: 12.522452,
    longitude: 121.442176,
    name: 'BFP Mansalay Fire Station',
  });
});

test('suggests at least one minute for the station and incident coordinates', () => {
  expect(calculateStationDistanceKm(12.4, 121.44)).toBeCloseTo(13.6, 0);
  expect(suggestArrivalMinutes(12.4, 121.44)).toBe(17);
  expect(suggestArrivalMinutes(12.522452, 121.442176)).toBe(1);
});

test('returns no suggestion for absent or invalid incident coordinates', () => {
  expect(calculateStationDistanceKm(null, null)).toBeNull();
  expect(suggestArrivalMinutes(null, null)).toBeNull();
  expect(suggestArrivalMinutes(91, 121.44)).toBeNull();
});
