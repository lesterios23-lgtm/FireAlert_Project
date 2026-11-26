import React, { useCallback, useEffect, useRef, useState } from 'react';
import GoogleMap from './GoogleMap';
import { hasGoogleMapsKey } from './googleMaps';
import { BFP_STATION_LOCATION, ESTIMATED_RESPONSE_SPEED_KMH } from './stationLocation';
import {
  buildFallbackRoute,
  buildGoogleMapsDirectionsUrl,
  estimatedArrivalClock,
  fetchDrivingRoutes,
  formatDistanceKm,
  formatDurationMinutes,
  haversineDistanceKm,
  routeOriginLabel,
  routeSourceLabel,
  validPoint,
} from './routeNavigation';
import '../../styles/routeNavigation.css';

const SHARE_INTERVAL_MS = 8000;
const SHARE_MIN_DISTANCE_KM = 0.015;
const REROUTE_MIN_DISTANCE_KM = 0.03;
const REROUTE_MIN_INTERVAL_MS = 12000;
const ARRIVAL_RADIUS_METERS = 75;
const ARRIVAL_STATIONARY_METERS = 15;
const ARRIVAL_DWELL_MS = 10000;

function geolocationMessage(error) {
  switch (error?.code) {
    case 1:
      return 'Location permission was denied. Allow GPS access in your browser to share the response unit position.';
    case 2:
      return 'GPS position is currently unavailable. Move to an open area and try again.';
    case 3:
      return 'GPS request timed out. Check your connection and try again.';
    default:
      return error?.message || 'Unable to read the device GPS position.';
  }
}

function accuracyLabel(accuracy) {
  if (!Number.isFinite(accuracy)) return 'GPS active';
  return `GPS active · ±${Math.max(1, Math.round(accuracy))} m`;
}

/**
 * Turns a stored dispatch fix (accuracyMeters / updatedAt) into the same shape
 * the device GPS callback produces, so one code path drives both views.
 */
function responderReading(value) {
  const point = validPoint(value);
  if (!point) return null;

  const accuracy = Number(value.accuracy ?? value.accuracyMeters);
  const updatedAt = value.updatedAt ? new Date(value.updatedAt) : null;

  return {
    ...point,
    accuracy: Number.isFinite(accuracy) ? accuracy : NaN,
    timestamp: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
  };
}

export function useRouteNavigation({
  destination,
  origin = BFP_STATION_LOCATION,
  existingResponder = null,
  onShareLocation = null,
  persistLabel = 'responding unit',
  canAutoArrive = false,
  onAutoArrive = null,
}) {
  const destinationPoint = validPoint(destination);
  const destinationLat = destinationPoint?.latitude ?? null;
  const destinationLng = destinationPoint?.longitude ?? null;
  const destinationKey = destinationPoint ? `${destinationLat},${destinationLng}` : '';

  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeState, setRouteState] = useState('idle');
  const [routeOrigin, setRouteOrigin] = useState(() => validPoint(origin));
  const [fitToken, setFitToken] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(() => responderReading(existingResponder));
  const [tracking, setTracking] = useState(false);
  const [hasDeviceFix, setHasDeviceFix] = useState(false);
  const [geolocationError, setGeolocationError] = useState('');
  const [shareError, setShareError] = useState('');
  const [lastSharedAt, setLastSharedAt] = useState(null);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [arrivalPending, setArrivalPending] = useState(false);

  const watchIdRef = useRef(null);
  const trackingActiveRef = useRef(false);
  const hasDeviceFixRef = useRef(false);
  const onShareLocationRef = useRef(onShareLocation);
  const onAutoArriveRef = useRef(onAutoArrive);
  const canAutoArriveRef = useRef(canAutoArrive);
  const stationaryAnchorRef = useRef(null);
  const arrivalTimerRef = useRef(null);
  const autoArrivedRef = useRef(false);
  const lastSharedRef = useRef(null);
  const lastRerouteRef = useRef(null);
  const previousDestinationRef = useRef('');
  const fittedDestinationRef = useRef('');

  const routeOriginLat = routeOrigin?.latitude ?? null;
  const routeOriginLng = routeOrigin?.longitude ?? null;
  const livePosition = currentPosition || responderReading(existingResponder);
  const hasLiveOrigin = Boolean(livePosition && routeOrigin
    && (hasDeviceFix || Boolean(existingResponder))
    && Math.abs(livePosition.latitude - routeOrigin.latitude) < 0.0002
    && Math.abs(livePosition.longitude - routeOrigin.longitude) < 0.0002);

  useEffect(() => {
    onShareLocationRef.current = onShareLocation;
  }, [onShareLocation]);

  useEffect(() => {
    onAutoArriveRef.current = onAutoArrive;
  }, [onAutoArrive]);

  const clearArrivalState = useCallback(() => {
    if (arrivalTimerRef.current != null) {
      clearTimeout(arrivalTimerRef.current);
      arrivalTimerRef.current = null;
    }
    stationaryAnchorRef.current = null;
    setArrivalPending(false);
  }, []);

  useEffect(() => {
    canAutoArriveRef.current = canAutoArrive;
    if (!canAutoArrive) {
      clearArrivalState();
    }
  }, [canAutoArrive, clearArrivalState]);

  const stopTracking = useCallback(() => {
    trackingActiveRef.current = false;
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setTracking(false);
    clearArrivalState();
  }, [clearArrivalState]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  // Reset the route when the selected incident changes.
  useEffect(() => {
    if (previousDestinationRef.current === destinationKey) return;
    previousDestinationRef.current = destinationKey;

    if (watchIdRef.current != null) stopTracking();
    clearArrivalState();
    autoArrivedRef.current = false;
    setRoutes([]);
    setRouteState('idle');
    setSelectedRouteIndex(0);
    setShowAllSteps(false);
    setShareError('');
    setGeolocationError('');
    setLastSharedAt(null);
    setCurrentPosition(responderReading(existingResponder));
    setHasDeviceFix(false);
    hasDeviceFixRef.current = false;
    lastSharedRef.current = null;
    lastRerouteRef.current = null;
    fittedDestinationRef.current = '';

    const fallbackOrigin = validPoint(existingResponder) || validPoint(origin);
    setRouteOrigin(fallbackOrigin);
  }, [clearArrivalState, destinationKey, existingResponder, origin, stopTracking]);

  // Resident view: follow the latest dispatch fix as it arrives from polling.
  useEffect(() => {
    if (tracking || hasDeviceFixRef.current) return;
    const responder = validPoint(existingResponder);
    if (!responder) return;

    setCurrentPosition((previous) => (
      previous
      && Math.abs(previous.latitude - responder.latitude) < 0.00005
      && Math.abs(previous.longitude - responder.longitude) < 0.00005
        ? previous
        : responderReading(existingResponder)
    ));
    setRouteOrigin((previous) => (
      previous
      && Math.abs(previous.latitude - responder.latitude) < 0.00005
      && Math.abs(previous.longitude - responder.longitude) < 0.00005
        ? previous
        : responder
    ));
  }, [existingResponder, tracking]);

  useEffect(() => {
    const destPt = destinationLat != null && destinationLng != null
      ? { latitude: destinationLat, longitude: destinationLng }
      : null;
    const originPoint = routeOriginLat != null && routeOriginLng != null
      ? { latitude: routeOriginLat, longitude: routeOriginLng }
      : null;

    if (!destPt || !originPoint) {
      setRoutes([]);
      setRouteState('idle');
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setRouteState('loading');

    fetchDrivingRoutes(originPoint, destPt, { signal: controller.signal })
      .then((nextRoutes) => {
        if (cancelled) return;
        setRoutes(nextRoutes);
        setSelectedRouteIndex(0);
        setRouteState(nextRoutes.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = buildFallbackRoute(originPoint, destPt);
        setRoutes(fallback ? [fallback] : []);
        setSelectedRouteIndex(0);
        setRouteState(fallback ? 'ready' : 'empty');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [destinationLat, destinationLng, routeOriginLat, routeOriginLng]);

  // Zoom to the full route once per destination, not on every GPS update.
  useEffect(() => {
    if (routeState !== 'ready' || routes.length === 0) return;
    if (fittedDestinationRef.current === destinationKey) return;

    fittedDestinationRef.current = destinationKey;
    setFitToken((value) => value + 1);
  }, [routeState, routes.length, destinationKey]);

  const sharePosition = useCallback((position) => {
    const share = onShareLocationRef.current;
    if (!share) return;

    const now = Date.now();
    const previous = lastSharedRef.current;
    if (previous
      && now - previous.time < SHARE_INTERVAL_MS
      && haversineDistanceKm(previous.point, position) < SHARE_MIN_DISTANCE_KM) {
      return;
    }

    lastSharedRef.current = { time: now, point: position };
    setShareError('');

    Promise.resolve(share(position))
      .then(() => setLastSharedAt(new Date()))
      .catch((error) => {
        lastSharedRef.current = null;
        setShareError(error?.message || `Unable to publish the ${persistLabel} location.`);
      });
  }, [persistLabel]);

  const handlePosition = useCallback((position) => {
    const next = validPoint({
      latitude: position?.coords?.latitude,
      longitude: position?.coords?.longitude,
    });
    if (!next) return;

    const reading = {
      ...next,
      accuracy: Number(position?.coords?.accuracy),
      timestamp: position?.timestamp ? new Date(position.timestamp) : new Date(),
    };

    setCurrentPosition(reading);
    setGeolocationError('');
    setHasDeviceFix(true);
    hasDeviceFixRef.current = true;
    sharePosition(reading);

    const now = Date.now();
    const previous = lastRerouteRef.current;
    if (!previous
      || now - previous.time >= REROUTE_MIN_INTERVAL_MS
      || haversineDistanceKm(previous.point, reading) >= REROUTE_MIN_DISTANCE_KM) {
      lastRerouteRef.current = { time: now, point: reading };
      setRouteOrigin({ latitude: next.latitude, longitude: next.longitude });
    }

    if (canAutoArriveRef.current && !autoArrivedRef.current && destinationLat != null && destinationLng != null) {
      const distanceMeters = haversineDistanceKm(reading, {
        latitude: destinationLat,
        longitude: destinationLng,
      }) * 1000;

      if (distanceMeters <= ARRIVAL_RADIUS_METERS) {
        const anchor = stationaryAnchorRef.current;
        if (!anchor || haversineDistanceKm(reading, anchor.point) * 1000 >= ARRIVAL_STATIONARY_METERS) {
          stationaryAnchorRef.current = { point: reading, since: now };
          setArrivalPending(true);
          if (arrivalTimerRef.current != null) {
            clearTimeout(arrivalTimerRef.current);
          }
          arrivalTimerRef.current = setTimeout(() => {
            if (autoArrivedRef.current || !canAutoArriveRef.current) return;
            autoArrivedRef.current = true;
            clearArrivalState();
            stopTracking();
            onAutoArriveRef.current?.(reading);
          }, ARRIVAL_DWELL_MS);
        } else if (now - anchor.since >= ARRIVAL_DWELL_MS) {
          autoArrivedRef.current = true;
          clearArrivalState();
          stopTracking();
          onAutoArriveRef.current?.(reading);
        }
      } else {
        clearArrivalState();
      }
    }
  }, [clearArrivalState, destinationLat, destinationLng, sharePosition, stopTracking]);

  const startTracking = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeolocationError('GPS is not available in this browser.');
      return;
    }

    setGeolocationError('');
    setTracking(true);
    trackingActiveRef.current = true;

    try {
      const watchId = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          setGeolocationError(geolocationMessage(error));
          stopTracking();
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        },
      );

      if (!trackingActiveRef.current) {
        navigator.geolocation.clearWatch(watchId);
      } else {
        watchIdRef.current = watchId;
      }
    } catch (error) {
      trackingActiveRef.current = false;
      setGeolocationError(error?.message || 'Unable to start GPS tracking.');
      setTracking(false);
    }
  };

  const toggleTracking = () => {
    if (tracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  const activeRoute = routes[selectedRouteIndex] || routes[0] || null;
  const steps = activeRoute?.steps || [];
  const visibleSteps = showAllSteps ? steps : steps.slice(0, 4);
  const mapsUrl = destinationPoint
    ? (livePosition
      ? buildGoogleMapsDirectionsUrl(livePosition, destinationPoint)
      : buildGoogleMapsDirectionsUrl(origin, destinationPoint))
    : null;
  const sourceLabel = routeState === 'loading'
    ? 'Calculating route…'
    : routeSourceLabel(activeRoute);
  const originLabel = hasLiveOrigin
    ? 'live position'
    : routeOriginLabel(false);
  const responderLabel = existingResponder?.unit_name
    ? `Unit ${existingResponder.unit_name}`
    : 'Responding unit';
  const syncedAt = lastSharedAt
    || (livePosition?.timestamp instanceof Date ? livePosition.timestamp : null);

  return {
    destinationPoint,
    routes,
    selectedRouteIndex,
    setSelectedRouteIndex,
    routeState,
    fitToken,
    setFitToken,
    currentPosition,
    livePosition,
    hasLiveOrigin,
    tracking,
    arrivalPending,
    geolocationError,
    shareError,
    showAllSteps,
    setShowAllSteps,
    toggleTracking,
    activeRoute,
    steps,
    visibleSteps,
    mapsUrl,
    sourceLabel,
    originLabel,
    responderLabel,
    syncedAt,
  };
}

export function RouteNavigationPanel({
  navigation,
  canTrack = false,
  readOnly = false,
}) {
  if (!navigation?.destinationPoint) {
    return (
      <p className='route-navigation-hint'>
        Add an incident map pin or GPS coordinates to calculate a suggested response route.
      </p>
    );
  }

  const {
    routes,
    selectedRouteIndex,
    setSelectedRouteIndex,
    routeState,
    setFitToken,
    currentPosition,
    hasLiveOrigin,
    tracking,
    arrivalPending,
    geolocationError,
    shareError,
    showAllSteps,
    setShowAllSteps,
    toggleTracking,
    activeRoute,
    steps,
    visibleSteps,
    mapsUrl,
    sourceLabel,
    originLabel,
    syncedAt,
  } = navigation;

  return (
    <section className='route-navigation-panel' aria-label='Suggested response route'>
      <div className='route-navigation-head'>
        <div>
          <span className='route-navigation-kicker'>
            {hasLiveOrigin ? 'Remaining route' : 'Suggested route'}
          </span>
          <strong>
            {routeState === 'loading'
              ? 'Finding the fastest road route…'
              : `${formatDistanceKm(activeRoute?.distanceKm)} · ${formatDurationMinutes(activeRoute?.durationMinutes)}`}
          </strong>
          <small>{hasLiveOrigin ? `From ${originLabel}` : `From ${BFP_STATION_LOCATION.name}`}</small>
        </div>
        <span className={`route-navigation-source${activeRoute?.source === 'estimated' ? ' is-estimated' : ''}`}>
          {sourceLabel}
        </span>
      </div>

      {routes.length > 1 && (
        <div className='route-navigation-options' role='group' aria-label='Suggested route options'>
          {routes.map((route, index) => (
            <button
              type='button'
              key={route.id || index}
              className={index === selectedRouteIndex ? 'active' : ''}
              aria-pressed={index === selectedRouteIndex}
              onClick={() => {
                setSelectedRouteIndex(index);
                setFitToken((value) => value + 1);
              }}
            >
              <span>{index === 0 ? 'Recommended' : `Alternative ${index}`}</span>
              <strong>{formatDistanceKm(route.distanceKm)} · {formatDurationMinutes(route.durationMinutes)}</strong>
            </button>
          ))}
        </div>
      )}

      <div className='route-navigation-stats'>
        <div>
          <span>DISTANCE</span>
          <strong>{formatDistanceKm(activeRoute?.distanceKm)}</strong>
        </div>
        <div>
          <span>TRAVEL TIME</span>
          <strong>{formatDurationMinutes(activeRoute?.durationMinutes)}</strong>
        </div>
        <div>
          <span>EST. ARRIVAL</span>
          <strong>{estimatedArrivalClock(activeRoute?.durationMinutes)}</strong>
        </div>
      </div>

      {tracking || hasLiveOrigin ? (
        <div className='route-navigation-live' role='status'>
          <span className='route-navigation-live-dot' aria-hidden='true' />
          <div>
            <strong>{tracking ? 'Sharing live GPS position' : 'Responder live position'}</strong>
            <small>
              {currentPosition
                ? `${accuracyLabel(currentPosition.accuracy)}${syncedAt ? ` · synced ${syncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
                : 'Waiting for the next GPS fix from the response unit.'}
            </small>
          </div>
        </div>
      ) : null}

      {geolocationError && <p className='route-navigation-error' role='alert'>{geolocationError}</p>}
      {shareError && <p className='route-navigation-warning' role='alert'>{shareError}</p>}
      {activeRoute?.source === 'estimated' && routeState === 'ready' && (
        <p className='route-navigation-warning'>
          Road routing is unavailable right now. Showing a straight-line estimate at{' '}
          {ESTIMATED_RESPONSE_SPEED_KMH} km/h instead; traffic, road closures, and turns may add time.
        </p>
      )}

      <div className='route-navigation-actions'>
        {canTrack && !readOnly && (
          <button
            type='button'
            className={`route-navigation-track${tracking ? ' is-tracking' : ''}`}
            onClick={toggleTracking}
            aria-pressed={tracking}
          >
            <span aria-hidden='true'>{tracking ? '■' : '➤'}</span>
            {tracking ? 'Stop GPS tracking' : 'Start live GPS tracking'}
          </button>
        )}
        {mapsUrl && (
          <a
            className='route-navigation-link'
            href={mapsUrl}
            target='_blank'
            rel='noreferrer'
          >
            Open in Google Maps
          </a>
        )}
      </div>

      {visibleSteps.length > 0 && (
        <div className='route-navigation-steps'>
          <div className='route-navigation-steps-head'>
            <h3>Turn-by-turn directions</h3>
            {steps.length > 4 && (
              <button type='button' onClick={() => setShowAllSteps((value) => !value)}>
                {showAllSteps ? 'Show fewer' : `Show all ${steps.length}`}
              </button>
            )}
          </div>
          <ol>
            {visibleSteps.map((step) => (
              <li key={step.id}>
                <span className={`route-step-icon step-${step.type || 'continue'}`} aria-hidden='true'>
                  {step.type === 'arrive' ? '⚑' : step.type === 'depart' ? '●' : '↱'}
                </span>
                <div>
                  <p>{step.instruction}</p>
                  {step.distanceKm > 0 && (
                    <small>{formatDistanceKm(step.distanceKm)} · {formatDurationMinutes(step.durationMinutes)}</small>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {routeState === 'ready' && activeRoute?.source === 'osrm' && (
        <p className='route-navigation-credit'>
          Road route by OSRM · map data © {hasGoogleMapsKey() ? 'Google' : 'OpenStreetMap contributors'}
        </p>
      )}
    </section>
  );
}

export default function RouteNavigationMap({
  destination,
  origin = BFP_STATION_LOCATION,
  markers = [],
  selected,
  height = '320px',
  flyTrigger = 0,
  title = 'Route navigation map',
  canTrack = false,
  readOnly = false,
  existingResponder = null,
  onShareLocation = null,
  persistLabel = 'responding unit',
  onMarkerClick = null,
}) {
  const navigation = useRouteNavigation({
    destination,
    origin,
    existingResponder,
    onShareLocation,
    persistLabel,
  });

  const renderMap = (overrides = {}) => {
    const shared = {
      markers,
      selected,
      height,
      flyTrigger,
      title,
      allowFullscreen: true,
      onMarkerClick,
    };

    return <GoogleMap {...shared} {...overrides} />;
  };

  if (!navigation.destinationPoint) {
    return (
      <div className='route-navigation'>
        {renderMap()}
        <p className='route-navigation-hint'>
          Add an incident map pin or GPS coordinates to calculate a suggested response route.
        </p>
      </div>
    );
  }

  return (
    <div className='route-navigation'>
      <div className='route-navigation-map'>
        {renderMap({
          route: navigation.activeRoute?.geometry || null,
          routeDashed: navigation.activeRoute?.source === 'estimated',
          routeFitToken: navigation.fitToken,
          responder: navigation.livePosition
            ? { ...navigation.livePosition, label: navigation.responderLabel }
            : null,
        })}
        {navigation.tracking && (
          <span className='route-navigation-live-badge' role='status'>
            <i aria-hidden='true' /> Live GPS
          </span>
        )}
      </div>

      <RouteNavigationPanel
        navigation={navigation}
        canTrack={canTrack}
        readOnly={readOnly}
      />
    </div>
  );
}
