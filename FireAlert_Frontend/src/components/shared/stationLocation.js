export const BFP_STATION_LOCATION = Object.freeze({
  latitude: 12.522452,
  longitude: 121.442176,
  name: 'BFP Mansalay Fire Station',
});

export const ESTIMATED_RESPONSE_SPEED_KMH = 50;

function validCoordinate(latitude, longitude) {
  if (latitude == null || longitude == null
    || (typeof latitude === 'string' && latitude.trim() === '')
    || (typeof longitude === 'string' && longitude.trim() === '')) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

export function calculateStationDistanceKm(latitude, longitude) {
  const incident = validCoordinate(latitude, longitude);
  if (!incident) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(incident.latitude - BFP_STATION_LOCATION.latitude);
  const longitudeDelta = radians(incident.longitude - BFP_STATION_LOCATION.longitude);
  const stationLatitude = radians(BFP_STATION_LOCATION.latitude);
  const incidentLatitude = radians(incident.latitude);
  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(stationLatitude) * Math.cos(incidentLatitude)
    * Math.sin(longitudeDelta / 2) ** 2
  );
  const earthRadiusKm = 6371;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function suggestArrivalMinutes(latitude, longitude) {
  const distanceKm = calculateStationDistanceKm(latitude, longitude);
  if (distanceKm === null) return null;

  return Math.max(1, Math.ceil((distanceKm / ESTIMATED_RESPONSE_SPEED_KMH) * 60));
}
