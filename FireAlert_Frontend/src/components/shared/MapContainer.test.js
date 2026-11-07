import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import L from 'leaflet';
import MapContainer from './MapContainer';

const map = {
  attributionControl: { setPrefix: jest.fn() },
  getZoom: jest.fn(() => 13),
  fitBounds: jest.fn(),
  on: jest.fn(),
  remove: jest.fn(),
  setView: jest.fn(),
};
const markersLayer = { addTo: jest.fn(() => markersLayer), clearLayers: jest.fn() };
const marker = { addTo: jest.fn(), bindTooltip: jest.fn(), on: jest.fn() };
const boundaryBounds = { contains: jest.fn(() => true) };
const boundaryLayer = { addTo: jest.fn(() => boundaryLayer), getBounds: jest.fn(() => boundaryBounds) };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(L, 'map').mockReturnValue(map);
  jest.spyOn(L, 'tileLayer').mockReturnValue({ addTo: jest.fn() });
  jest.spyOn(L, 'geoJSON').mockReturnValue(boundaryLayer);
  jest.spyOn(L, 'layerGroup').mockReturnValue(markersLayer);
  jest.spyOn(L, 'marker').mockReturnValue(marker);
  map.getZoom.mockReturnValue(13);
  markersLayer.addTo.mockReturnValue(markersLayer);
  boundaryLayer.addTo.mockReturnValue(boundaryLayer);
  boundaryLayer.getBounds.mockReturnValue(boundaryBounds);
  boundaryBounds.contains.mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('uses attributed OpenStreetMap tiles with a referrer policy', () => {
  render(<MapContainer />);

  expect(L.tileLayer).toHaveBeenCalledWith(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    expect.objectContaining({
      attribution: expect.stringContaining('OpenStreetMap'),
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  );
  expect(L.tileLayer.mock.calls[0][1].attribution).toContain('Who&#39;s On First');
  expect(L.geoJSON).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'Feature',
      properties: expect.objectContaining({ name: 'Mansalay' }),
      geometry: expect.objectContaining({ type: 'Polygon' }),
    }),
    expect.objectContaining({
      style: expect.objectContaining({ color: '#d93636', weight: 1.5, fill: false }),
    })
  );
  expect(map.fitBounds).toHaveBeenCalledWith(boundaryBounds, {
    padding: [18, 18],
    maxZoom: 12,
  });
  expect(screen.getByRole('application', { name: /OpenStreetMap/i })).toBeInTheDocument();
});

test('places a marker on tap and allows the marker to be dragged', () => {
  const onLocationSelect = jest.fn();
  render(
    <MapContainer
      markers={[{ id: 'report-1', lat: 12.4, lng: 121.44 }]}
      selected={{ latitude: 12.4, longitude: 121.44 }}
      onLocationSelect={onLocationSelect}
    />
  );

  const clickHandler = map.on.mock.calls
    .find(([eventName]) => eventName === 'click')[1];
  clickHandler({ latlng: { lat: 12.41, lng: 121.45 } });
  expect(onLocationSelect).toHaveBeenCalledWith({ latitude: 12.41, longitude: 121.45 });

  expect(L.layerGroup).toHaveBeenCalled();
  expect(markersLayer.clearLayers).toHaveBeenCalled();
  expect(L.marker).toHaveBeenCalled();
  const markerInstance = L.marker.mock.results[0].value;
  const dragHandler = markerInstance.on.mock.calls
    .find(([eventName]) => eventName === 'dragend')[1];
  dragHandler({ target: { getLatLng: () => ({ lat: 12.42, lng: 121.46 }) } });
  expect(onLocationSelect).toHaveBeenLastCalledWith({ latitude: 12.42, longitude: 121.46 });
});

test('always shows the permanent BFP Mansalay station pin and label', () => {
  render(<MapContainer markers={[{ id: 'report-1', lat: 12.4, lng: 121.44 }]} />);

  expect(L.marker).toHaveBeenCalledWith(
    [12.522452, 121.442176],
    expect.objectContaining({
      title: 'BFP Mansalay Fire Station',
      zIndexOffset: 1000,
    })
  );
  expect(marker.bindTooltip).toHaveBeenCalledWith(
    'BFP Mansalay Fire Station',
    expect.objectContaining({ permanent: true })
  );
});

test('uses a transparent flame-shaped pin for each incident marker', () => {
  render(<MapContainer markers={[{ id: 'report-1', lat: 12.4, lng: 121.44 }]} />);

  const incidentIcon = L.marker.mock.calls
    .find(([, options]) => options?.title === 'Fire incident location')[1].icon;
  expect(incidentIcon.options.className).toBe('fire-map-pin-icon');
  expect(incidentIcon.options.html).toContain('<svg');
  expect(incidentIcon.options.html).toContain('fire-map-pin-shape');
  expect(incidentIcon.options.html).toContain('fire-map-pin-flame');
  expect(incidentIcon.options.iconAnchor).toEqual([16, 39]);
});

test('keeps the full Mansalay view for pins within the municipality boundary', () => {
  render(
    <MapContainer
      selected={{ latitude: 12.52, longitude: 121.44 }}
      markers={[{ id: 'report-1', lat: 12.52, lng: 121.44 }]}
    />
  );

  expect(boundaryBounds.contains).toHaveBeenCalledWith([12.52, 121.44]);
  expect(map.setView).not.toHaveBeenCalled();
});

test('recenters selected locations outside Mansalay', () => {
  boundaryBounds.contains.mockReturnValue(false);
  render(<MapContainer selected={{ latitude: 13, longitude: 122 }} />);

  expect(map.setView).toHaveBeenCalledWith([13, 122], 15);
});
