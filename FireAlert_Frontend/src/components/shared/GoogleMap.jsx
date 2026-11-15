import React, { useEffect, useRef, useState } from 'react';
import mansalayBoundary from './mansalayBoundary.json';
import { BFP_STATION_LOCATION } from './stationLocation';
import {
  buildFirePinIcon,
  buildResponderPinIcon,
  buildStationPinIcon,
  coordinatesOf,
  hasGoogleMapsKey,
  loadGoogleMaps,
  routeCoordinates,
} from './googleMaps';
import LeafletMap from './LeafletMap';

const BOUNDARY_STYLE = {
  strokeColor: '#d93636',
  strokeWeight: 1.5,
  strokeOpacity: 0.85,
  fillOpacity: 0,
};

function toMapsIcon(maps, icon) {
  return {
    url: icon.url,
    scaledSize: new maps.Size(icon.scaledSize.width, icon.scaledSize.height),
    anchor: new maps.Point(icon.anchor.x, icon.anchor.y),
  };
}

function markersSignature(markers) {
  return (markers || [])
    .map((marker) => `${marker?.id ?? ''}:${marker?.lat ?? ''}:${marker?.lng ?? ''}:${marker?.address ?? ''}`)
    .join('|');
}

function routeSignature(route) {
  if (!Array.isArray(route)) return '';
  return route
    .map((point) => (Array.isArray(point) ? `${point[0]},${point[1]}` : `${point?.latitude},${point?.longitude}`))
    .join('|');
}

function boundaryBounds(maps) {
  const bounds = new maps.LatLngBounds();
  mansalayBoundary.geometry.coordinates.forEach((ring) => {
    ring.forEach(([longitude, latitude]) => bounds.extend({ lat: latitude, lng: longitude }));
  });
  return bounds;
}

function GoogleMapsRenderer(props) {
  const {
    markers = [],
    selected,
    height = '320px',
    onLocationSelect,
    flyTrigger = 0,
    allowFullscreen = true,
    title = 'Mansalay Fire Map',
    route = null,
    routeColor = '#d94f42',
    routeDashed = false,
    routeFitToken = null,
    responder = null,
    onUnavailable,
  } = props;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapsRef = useRef(null);
  const overlaysRef = useRef([]);
  const fitTokenRef = useRef(null);
  const lastOverlaysSignatureRef = useRef('');
  const onLocationSelectRef = useRef(onLocationSelect);
  const onUnavailableRef = useRef(onUnavailable);
  const latestPropsRef = useRef({});
  const latestSelectedRef = useRef(selected);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const selectedPosition = coordinatesOf(selected);
  const responderPosition = coordinatesOf(responder);
  const responderLabel = responder?.label || 'Responding unit';
  const isPinPicker = Boolean(onLocationSelect);

  useEffect(() => { latestSelectedRef.current = selected; }, [selected]);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
    onUnavailableRef.current = onUnavailable;
  }, [onLocationSelect, onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;

        const map = new maps.Map(containerRef.current, {
          center: { lat: BFP_STATION_LOCATION.latitude, lng: BFP_STATION_LOCATION.longitude },
          zoom: 12,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: 'greedy',
        });

        try {
          map.data.addGeoJson(mansalayBoundary);
          map.data.setStyle(BOUNDARY_STYLE);
        } catch {
          // decorative
        }

        const picked = coordinatesOf(latestSelectedRef.current);
        if (picked) {
          map.setCenter(picked);
          map.setZoom(15);
        } else {
          map.fitBounds(boundaryBounds(maps), 18);
        }

        map.addListener('click', (event) => {
          onLocationSelectRef.current?.({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        });

        mapRef.current = map;
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        onUnavailableRef.current?.();
      });

    return () => {
      cancelled = true;
      const maps = mapsRef.current;
      if (maps && mapRef.current) maps.event.clearInstanceListeners(mapRef.current);
      overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      overlaysRef.current = [];
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, [loadAttempt]);

  const overlaysSignature = [
    markersSignature(markers),
    routeSignature(route),
    responder ? `${responderPosition?.lat}:${responderPosition?.lng}:${responderLabel}:${responder?.unit_name ?? ''}` : '',
    selectedPosition ? `${selectedPosition.lat}:${selectedPosition.lng}` : '',
    routeColor,
    routeDashed ? 'dashed' : 'solid',
    isPinPicker ? 'picker' : 'display',
    status,
  ].join('|');

  useEffect(() => {
    latestPropsRef.current = { markers, route, routeColor, routeDashed, responder, responderLabel, selectedPosition };
  });

  useEffect(() => {
    if (lastOverlaysSignatureRef.current === overlaysSignature) return;
    lastOverlaysSignatureRef.current = overlaysSignature;
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || status !== 'ready') return;

    const p = latestPropsRef.current;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    const add = (overlay) => { overlay.setMap(map); overlaysRef.current.push(overlay); return overlay; };

    const points = routeCoordinates(p.route);
    if (points.length > 1) {
      add(new maps.Polyline({ path: points, strokeColor: '#ffffff', strokeWeight: 9, strokeOpacity: 0.92 }));
      add(new maps.Polyline({ path: points, strokeColor: p.routeColor, strokeWeight: 5, strokeOpacity: p.routeDashed ? 0.8 : 0.95 }));
    }

    const stationMarker = add(new maps.Marker({
      position: { lat: BFP_STATION_LOCATION.latitude, lng: BFP_STATION_LOCATION.longitude },
      icon: toMapsIcon(maps, buildStationPinIcon()), title: BFP_STATION_LOCATION.name, zIndex: 1000,
    }));
    new maps.InfoWindow({ content: BFP_STATION_LOCATION.name }).open(map, stationMarker);

    (p.markers || []).forEach((marker) => {
      const position = coordinatesOf({ latitude: marker?.lat, longitude: marker?.lng });
      if (!position) return;
      const isSelected = p.selectedPosition
        && Math.abs(position.lat - p.selectedPosition.lat) < 0.0001
        && Math.abs(position.lng - p.selectedPosition.lng) < 0.0001;
      const pin = add(new maps.Marker({
        position, icon: toMapsIcon(maps, buildFirePinIcon(isSelected)),
        title: marker.address || 'Fire incident location', draggable: isPinPicker && isSelected, zIndex: isSelected ? 1200 : 500,
      }));
      if (isPinPicker && isSelected) {
        pin.addListener('dragend', (event) => {
          onLocationSelectRef.current?.({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        });
      }
      if (marker.address) new maps.InfoWindow({ content: marker.address }).open(map, pin);
    });

    const responderPos = p.responder ? coordinatesOf(p.responder) : null;
    if (responderPos) {
      const unit = p.responder?.unit_name ? `Unit ${p.responder.unit_name}` : null;
      const responderMarker = add(new maps.Marker({
        position: responderPos, icon: toMapsIcon(maps, buildResponderPinIcon()), title: p.responderLabel, zIndex: 1400,
      }));
      new maps.InfoWindow({ content: unit || p.responderLabel }).open(map, responderMarker);
    }
  }, [overlaysSignature, status, isPinPicker]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || status !== 'ready' || routeFitToken == null) return;
    if (fitTokenRef.current === routeFitToken) return;
    const points = routeCoordinates(route);
    if (points.length < 2) return;
    fitTokenRef.current = routeFitToken;
    const bounds = new maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 26);
  }, [routeFitToken, route, status]);

  const selectedKey = selectedPosition ? `${selectedPosition.lat},${selectedPosition.lng}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPosition) return;
    map.panTo(selectedPosition);
    map.setZoom(Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTrigger, selectedKey]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    const triggerResize = () => { if (mapRef.current && mapsRef.current) mapsRef.current.event.trigger(mapRef.current, 'resize'); };
    const t1 = setTimeout(triggerResize, 60);
    const t2 = setTimeout(triggerResize, 240);
    return () => { document.body.style.overflow = ''; clearTimeout(t1); clearTimeout(t2); };
  }, [isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className={`fire-map-wrapper${isFullscreen ? ' is-fullscreen' : ''}`}>
      {allowFullscreen && !isFullscreen && (
        <button type='button' className='fire-map-fullscreen-btn' onClick={() => setIsFullscreen(true)} aria-label='View map in full screen' title='Full screen map view'>
          <span className='fire-map-fullscreen-icon' aria-hidden='true'>⛶</span><span>Full Screen</span>
        </button>
      )}
      {isFullscreen && (
        <div className='fire-map-fullscreen-header'>
          <div className='fire-map-fullscreen-title'>
            <strong><span aria-hidden='true'>{isPinPicker ? '📍' : '🗺️'}</span>{isPinPicker ? 'Pin Fire Location' : title}</strong>
            <small>{isPinPicker ? 'Tap anywhere on the map or drag the pin to set the location' : 'Pinch and drag to explore the suggested response route'}</small>
          </div>
          <div className='fire-map-fullscreen-actions'>
            {isPinPicker && <button type='button' className='fire-map-fullscreen-btn-done' onClick={() => setIsFullscreen(false)}>✓ Done</button>}
            <button type='button' className='fire-map-fullscreen-btn-close' onClick={() => setIsFullscreen(false)} aria-label='Exit full screen'>✕ Exit</button>
          </div>
        </div>
      )}
      <div ref={containerRef} className='fire-map-container' style={{ height: isFullscreen ? '100%' : height }} role='application' aria-label='Google Maps showing fire incident locations and the suggested response route' />
      {status === 'loading' && (
        <div className='google-maps-status'><span role='status'>Loading Google Maps…</span></div>
      )}
      {isFullscreen && selectedPosition && (
        <div className='fire-map-fullscreen-bottom-bar'>
          <button type='button' className='fire-map-fullscreen-center-btn' onClick={() => { if (mapRef.current && mapsRef.current) { mapsRef.current.event.trigger(mapRef.current, 'resize'); mapRef.current.panTo(selectedPosition); } }}>
            <span aria-hidden='true'>🎯</span> Center on Pin
          </button>
          <span className='fire-map-fullscreen-coord-pill'>{selectedPosition.lat.toFixed(5)}, {selectedPosition.lng.toFixed(5)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Prefers Google Maps when `REACT_APP_GOOGLE_MAPS_API_KEY` is configured.
 * Falls back to OpenStreetMap/Leaflet automatically if no key is set or the
 * Google Maps script cannot be loaded, so the app keeps working.
 */
export default function GoogleMap(props) {
  const [fallback, setFallback] = useState(!hasGoogleMapsKey());

  if (fallback) {
    return <LeafletMap {...props} />;
  }

  return <GoogleMapsRenderer {...props} onUnavailable={() => setFallback(true)} />;
}
