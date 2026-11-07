import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import mansalayBoundary from './mansalayBoundary.json';
import { BFP_STATION_LOCATION } from './stationLocation';
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Mansalay boundary: <a href="https://whosonfirst.org/docs/licenses/">Who&#39;s On First</a>';
const BOUNDARY_STYLE = {
  color: '#d93636',
  weight: 1.5,
  opacity: 0.85,
  fill: false,
  interactive: false,
};

const incidentPinIcon = L.divIcon({
  className: 'fire-map-pin-icon',
  html: '<svg viewBox="0 0 32 40" aria-hidden="true" focusable="false"><path class="fire-map-pin-shape" d="M16 1C7.72 1 1 7.72 1 16c0 10.1 15 23 15 23s15-12.9 15-23C31 7.72 24.28 1 16 1Z"/><path class="fire-map-pin-flame" d="M17.3 8.5c.3 2.6-.9 4.1-2.1 5.4-1.1 1.2-2 2.3-2 4.4a3.1 3.1 0 0 0 6.2 0c0-.5-.1-.9-.3-1.3 1.2.9 2 2.3 2 3.8a5.2 5.2 0 0 1-10.4 0c0-2.4 1.3-4.1 2.8-5.8 1.6-1.7 3.3-3.5 3.8-6.5Z"/></svg>',
  iconSize: [32, 40],
  iconAnchor: [16, 39],
});

const pulsingPinIcon = L.divIcon({
  className: 'fire-map-pin-icon fire-map-pin-pulsing',
  html: '<div class="fire-map-pin-wrap"><span class="fire-map-pulse-ring" aria-hidden="true"></span><span class="fire-map-pulse-ring ring-2" aria-hidden="true"></span><svg viewBox="0 0 32 40" aria-hidden="true" focusable="false"><path class="fire-map-pin-shape active" d="M16 1C7.72 1 1 7.72 1 16c0 10.1 15 23 15 23s15-12.9 15-23C31 7.72 24.28 1 16 1Z"/><path class="fire-map-pin-flame" d="M17.3 8.5c.3 2.6-.9 4.1-2.1 5.4-1.1 1.2-2 2.3-2 4.4a3.1 3.1 0 0 0 6.2 0c0-.5-.1-.9-.3-1.3 1.2.9 2 2.3 2 3.8a5.2 5.2 0 0 1-10.4 0c0-2.4 1.3-4.1 2.8-5.8 1.6-1.7 3.3-3.5 3.8-6.5Z"/></svg></div>',
  iconSize: [44, 52],
  iconAnchor: [22, 45],
});

const stationPinIcon = L.divIcon({
  className: 'fire-map-station-pin-icon',
  html: '<span aria-hidden="true">BFP</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function coordinatesOf(value) {
  if (value?.latitude == null || value?.longitude == null) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return [latitude, longitude];
}

export default function MapContainer({
  markers = [],
  selected,
  height = '420px',
  onLocationSelect,
  flyTrigger = 0,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const boundaryBoundsRef = useRef(null);
  const markersLayerRef = useRef(null);
  const onLocationSelectRef = useRef(onLocationSelect);
  const isFirstLoadRef = useRef(true);
  const selectedPosition = coordinatesOf(selected);
  const selectedLatitude = selectedPosition ? selectedPosition[0] : null;
  const selectedLongitude = selectedPosition ? selectedPosition[1] : null;

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      attributionControl: true,
      zoomControl: true,
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: MAP_ATTRIBUTION,
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(map);

    const boundaryLayer = L.geoJSON(mansalayBoundary, { style: BOUNDARY_STYLE });
    boundaryLayer.addTo(map);
    const boundaryBounds = boundaryLayer.getBounds();
    boundaryBoundsRef.current = boundaryBounds;
    map.fitBounds(boundaryBounds, { padding: [18, 18], maxZoom: 12 });

    map.on('click', (event) => {
      onLocationSelectRef.current?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });

    mapRef.current = map;
    const markersLayer = L.layerGroup();
    markersLayer.addTo(map);
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      boundaryBoundsRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || selectedLatitude == null || selectedLongitude == null) return;

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      mapRef.current.setView([selectedLatitude, selectedLongitude], 15);
      return;
    }

    const targetZoom = Math.max(mapRef.current.getZoom(), 16);
    mapRef.current.flyTo([selectedLatitude, selectedLongitude], targetZoom, {
      animate: true,
      duration: 1.8,
      easeLinearity: 0.25,
    });
  }, [selectedLatitude, selectedLongitude, flyTrigger]);

  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    const stationPin = L.marker([BFP_STATION_LOCATION.latitude, BFP_STATION_LOCATION.longitude], {
      icon: stationPinIcon,
      keyboard: true,
      title: BFP_STATION_LOCATION.name,
      zIndexOffset: 1000,
    });
    stationPin.bindTooltip(BFP_STATION_LOCATION.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -14],
      className: 'fire-map-station-label',
    });
    stationPin.addTo(markersLayerRef.current);

    markers.forEach((marker) => {
      const position = coordinatesOf({
        latitude: marker?.lat,
        longitude: marker?.lng,
      });
      if (!position) return;

      const isSelected = selectedPosition
        && Math.abs(position[0] - selectedPosition[0]) < 0.0001
        && Math.abs(position[1] - selectedPosition[1]) < 0.0001;

      const pin = L.marker(position, {
        draggable: Boolean(onLocationSelect),
        icon: isSelected ? pulsingPinIcon : incidentPinIcon,
        keyboard: true,
        title: marker.address || 'Fire incident location',
        zIndexOffset: isSelected ? 1200 : 500,
      });

      if (marker.address) {
        pin.bindTooltip(marker.address, {
          direction: 'top',
          offset: [0, -32],
          className: isSelected ? 'fire-map-pin-label active' : 'fire-map-pin-label',
        });
        if (isSelected) {
          pin.openTooltip();
        }
      }

      if (onLocationSelect) {
        pin.on('dragend', (event) => {
          const point = event.target.getLatLng();
          onLocationSelectRef.current?.({
            latitude: point.lat,
            longitude: point.lng,
          });
        });
      }

      pin.addTo(markersLayerRef.current);
    });
  }, [markers, onLocationSelect, selectedPosition]);

  return (
    <div
      ref={containerRef}
      className='fire-map-container'
      style={{ height }}
      role='application'
      aria-label='OpenStreetMap showing fire incident locations and the Mansalay municipal boundary'
    />
  );
}
