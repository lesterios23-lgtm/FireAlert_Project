import {
  BFP_STATION_LOCATION,
  ESTIMATED_RESPONSE_SPEED_KMH,
} from './stationLocation';

export const OSRM_ROUTE_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
export const DEFAULT_ROUTE_TIMEOUT_MS = 12000;

const EARTH_RADIUS_KM = 6371;
const ROUTE_CACHE_LIMIT = 24;
const routeCache = new Map();

const MODIFIER_LABELS = {
  uturn: 'U-turn',
  'sharp right': 'sharp right',
  'sharp left': 'sharp left',
  right: 'right',
  left: 'left',
  'slight right': 'slight right',
  'slight left': 'slight left',
  straight: 'straight',
};

export function validPoint(value) {
  if (!value) return null;

  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(value.longitude ?? value.lng ?? value.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90
    || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

export function haversineDistanceKm(from, to) {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const originLatitude = radians(origin.latitude);
  const destinationLatitude = radians(destination.latitude);
  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude)
    * Math.sin(longitudeDelta / 2) ** 2
  );

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function buildRouteUrl(from, to, { alternatives = true, steps = true } = {}) {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return null;

  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: steps ? 'true' : 'false',
  });
  if (alternatives) params.set('alternatives', 'true');

  return `${OSRM_ROUTE_BASE_URL}/${coordinates}?${params.toString()}`;
}

function openRouteServiceApiKey() {
  return String(process.env.REACT_APP_ORS_API_KEY || '').trim();
}

export function buildGoogleMapsDirectionsUrl(from, to) {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return null;

  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
    dir_action: 'navigate',
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function normalizeGeometry(coordinates) {
  if (!Array.isArray(coordinates)) return [];

  return coordinates
    .map(([longitude, latitude]) => validPoint({ latitude, longitude }))
    .filter(Boolean)
    .map((point) => [point.latitude, point.longitude]);
}

function modifierLabel(modifier) {
  return MODIFIER_LABELS[String(modifier || '').toLowerCase()] || '';
}

function roadLabel(name) {
  const road = String(name || '').trim();
  return road || 'the road';
}

export function describeStep(step) {
  const maneuver = step?.maneuver || {};
  const type = String(maneuver.type || '').toLowerCase();
  const modifier = modifierLabel(maneuver.modifier);
  const road = roadLabel(step?.name);
  const hasRoadName = Boolean(String(step?.name || '').trim());
  const onto = hasRoadName ? ` onto ${road}` : '';

  switch (type) {
    case 'depart':
      return hasRoadName ? `Start on ${road}` : 'Start from your current location';
    case 'arrive':
      return 'Arrive at the incident location';
    case 'turn':
      return `Turn ${modifier || 'ahead'}${onto}`;
    case 'new name':
    case 'continue':
      return `Continue ${modifier ? `${modifier} ` : ''}${hasRoadName ? `on ${road}` : 'ahead'}`;
    case 'merge':
      return `Merge ${modifier || 'ahead'}${onto}`;
    case 'fork':
      return `Keep ${modifier || 'ahead'} at the fork${onto}`;
    case 'end of road':
      return `At the end of the road, turn ${modifier || 'ahead'}${onto}`;
    case 'on ramp':
      return `Take the ramp${modifier ? ` ${modifier}` : ''}${onto}`;
    case 'off ramp':
      return `Take the exit${modifier ? ` ${modifier}` : ''}${onto}`;
    case 'roundabout':
    case 'rotary': {
      const exit = Number(maneuver.exit);
      const exitText = Number.isFinite(exit) && exit > 0 ? ` and take exit ${exit}` : '';
      return `Take the roundabout${exitText}${onto}`;
    }
    default: {
      if (!type) return hasRoadName ? `Continue on ${road}` : '';
      const action = type.charAt(0).toUpperCase() + type.slice(1);
      return `${action}${modifier ? ` ${modifier}` : ''}${onto}`;
    }
  }
}

export function normalizeRoute(rawRoute) {
  const geometry = normalizeGeometry(rawRoute?.geometry?.coordinates);
  if (geometry.length < 2) return null;

  const distanceKm = Number(rawRoute.distance) / 1000;
  const durationMinutes = Number(rawRoute.duration) / 60;
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMinutes)) return null;

  const legs = Array.isArray(rawRoute.legs) ? rawRoute.legs : [];
  const steps = legs.flatMap((leg, legIndex) => (
    (Array.isArray(leg?.steps) ? leg.steps : []).map((step, stepIndex) => {
      const stepDistanceKm = Number(step?.distance) / 1000;
      const stepDurationMinutes = Number(step?.duration) / 60;

      return {
        id: `${legIndex}-${stepIndex}`,
        instruction: describeStep(step),
        distanceKm: Number.isFinite(stepDistanceKm) ? stepDistanceKm : 0,
        durationMinutes: Number.isFinite(stepDurationMinutes) ? stepDurationMinutes : 0,
        road: step?.name || '',
        type: step?.maneuver?.type || '',
        modifier: step?.maneuver?.modifier || '',
      };
    })
  )).filter((step) => step.instruction);

  return {
    id: `route-${geometry[0].join('-')}-${geometry[geometry.length - 1].join('-')}`,
    geometry,
    distanceKm,
    durationMinutes,
    steps,
    source: 'osrm',
  };
}

export function buildFallbackRoute(from, to, { originLabel = '' } = {}) {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return null;

  const distanceKm = haversineDistanceKm(origin, destination) || 0;
  const durationMinutes = (distanceKm / ESTIMATED_RESPONSE_SPEED_KMH) * 60;
  const departure = originLabel
    ? `Start from ${originLabel}`
    : 'Start from your current location';

  return {
    id: `estimated-${origin.latitude}-${origin.longitude}-${destination.latitude}-${destination.longitude}`,
    geometry: [
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ],
    distanceKm,
    durationMinutes,
    source: 'estimated',
    steps: [
      {
        id: 'estimated-depart',
        instruction: departure,
        distanceKm: 0,
        durationMinutes: 0,
        road: '',
        type: 'depart',
        modifier: '',
      },
      {
        id: 'estimated-arrive',
        instruction: 'Continue straight to the incident location',
        distanceKm,
        durationMinutes,
        road: '',
        type: 'arrive',
        modifier: '',
      },
    ],
  };
}

function cacheKey(from, to, alternatives) {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return null;

  const round = (value) => Number(value).toFixed(4);
  return [
    round(origin.latitude),
    round(origin.longitude),
    round(destination.latitude),
    round(destination.longitude),
    alternatives ? 'alt' : 'best',
  ].join('|');
}

function rememberRoute(key, routes) {
  if (!key) return;
  if (routeCache.has(key)) routeCache.delete(key);
  routeCache.set(key, routes);
  while (routeCache.size > ROUTE_CACHE_LIMIT) {
    routeCache.delete(routeCache.keys().next().value);
  }
}

export function clearRouteCache() {
  routeCache.clear();
}

async function fetchOsrmOnce(url, request, timeoutMs, signal) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const abort = () => controller?.abort();
  const timer = controller ? setTimeout(abort, timeoutMs) : null;

  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener?.('abort', abort);
  }

  try {
    const response = await request(url, {
      signal: controller?.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response?.ok) {
      throw new Error(`Routing service returned HTTP ${response?.status ?? 'unknown'}.`);
    }

    const payload = await response.json();
    if (payload?.code !== 'Ok' || !Array.isArray(payload.routes)) {
      throw new Error(payload?.message || 'Routing service returned no route.');
    }

    const routes = payload.routes
      .map((route) => normalizeRoute(route))
      .filter(Boolean);

    if (routes.length === 0) {
      throw new Error('Routing service returned an empty route.');
    }

    return routes;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener?.('abort', abort);
  }
}

/**
 * Fetch driving routes (OSRM public demo). Retries once for transient failures,
 * then falls back to a straight-line estimate so the UI always has a suggestion.
 */
export async function fetchDrivingRoutes(from, to, {
  alternatives = true,
  timeoutMs = DEFAULT_ROUTE_TIMEOUT_MS,
  signal,
  fetchImpl,
} = {}) {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return [];

  const key = cacheKey(origin, destination, alternatives);
  if (key && routeCache.has(key)) {
    return routeCache.get(key);
  }

  const url = buildRouteUrl(origin, destination, { alternatives });
  const request = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!url || !request) {
    return [buildFallbackRoute(origin, destination)];
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal?.aborted) break;
    try {
      const routes = await fetchOsrmOnce(url, request, timeoutMs, signal);
      rememberRoute(key, routes);
      return routes;
    } catch {
      // retry once, then fall back
    }
  }

  return [buildFallbackRoute(origin, destination)];
}

export function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '—';
  if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 1000))} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export function formatDurationMinutes(durationMinutes) {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return '—';

  const minutes = Math.max(1, Math.ceil(durationMinutes));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours} hr` : `${hours} hr ${remaining} min`;
}

export function estimatedArrivalClock(durationMinutes, now = new Date()) {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return '—';

  const arrival = new Date(now.getTime() + durationMinutes * 60000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function routeSourceLabel(route) {
  return route?.source === 'osrm' ? 'Road route' : 'Estimated route';
}

export function routeOriginLabel(hasLivePosition) {
  return hasLivePosition ? 'your live position' : BFP_STATION_LOCATION.name;
}
