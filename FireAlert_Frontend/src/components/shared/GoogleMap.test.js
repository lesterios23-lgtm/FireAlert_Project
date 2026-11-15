import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import GoogleMap from './GoogleMap';

jest.mock('./googleMaps', () => {
  const actual = jest.requireActual('./googleMaps');
  return {
    ...actual,
    hasGoogleMapsKey: jest.fn(),
    loadGoogleMaps: jest.fn(),
  };
});

jest.mock('./LeafletMap', () => function MockLeafletMap() {
  return <div aria-label='Leaflet fallback map' />;
});

const { hasGoogleMapsKey, loadGoogleMaps } = jest.requireMock('./googleMaps');

const created = {
  maps: [],
  polylines: [],
  markers: [],
  infoWindows: [],
  fits: [],
};

class FakeOverlay {
  constructor(options) {
    this.options = options;
    this.map = null;
    this.listeners = {};
  }
  setMap(map) { this.map = map; }
  addListener(name, callback) { this.listeners[name] = callback; }
}

class FakeMap {
  constructor(element, options) {
    this.element = element;
    this.options = options;
    this.data = { addGeoJson: jest.fn(), setStyle: jest.fn() };
    this.listeners = {};
    this.panTo = jest.fn();
    this.setCenter = jest.fn();
    this.setZoom = jest.fn();
    this.getZoom = () => 12;
    this.fitBounds = (bounds, padding) => created.fits.push({ bounds, padding });
    created.maps.push(this);
  }
  addListener(name, callback) { this.listeners[name] = callback; }
}

const fakeMaps = {
  Map: FakeMap,
  Size: class { constructor(width, height) { this.width = width; this.height = height; } },
  Point: class { constructor(x, y) { this.x = x; this.y = y; } },
  LatLngBounds: class {
    constructor() { this.points = []; }
    extend(point) { this.points.push(point); }
  },
  Polyline: class extends FakeOverlay {
    constructor(options) { super(options); created.polylines.push(this); }
  },
  Marker: class extends FakeOverlay {
    constructor(options) { super(options); created.markers.push(this); }
  },
  InfoWindow: class {
    constructor(options) { this.options = options; this.open = jest.fn(); created.infoWindows.push(this); }
  },
  event: { clearInstanceListeners: jest.fn(), trigger: jest.fn() },
};

const destination = { latitude: 12.518, longitude: 121.438 };

beforeEach(() => {
  created.maps = [];
  created.polylines = [];
  created.markers = [];
  created.infoWindows = [];
  created.fits = [];
  hasGoogleMapsKey.mockReturnValue(true);
  loadGoogleMaps.mockResolvedValue(fakeMaps);
});

test('draws the route, station, incident pins and live responder on Google Maps', async () => {
  const route = [[12.522452, 121.442176], [12.518, 121.438]];
  render(
    <GoogleMap
      destination={destination}
      route={route}
      markers={[{ id: 7, lat: 12.518, lng: 121.438, address: 'Sitio Langawin' }]}
      selected={destination}
      responder={{ latitude: 12.52, longitude: 121.44, label: 'Unit Pumper 1' }}
      routeFitToken={1}
    />
  );

  await waitFor(() => expect(created.maps).toHaveLength(1));
  await waitFor(() => {
    expect(created.polylines).toHaveLength(2);
    expect(created.markers).toHaveLength(3);
  });

  expect(created.polylines[0].options.strokeColor).toBe('#ffffff');
  expect(created.polylines[1].options.strokeColor).toBe('#d94f42');
  expect(created.polylines[1].options.path).toEqual([
    { lat: 12.522452, lng: 121.442176 },
    { lat: 12.518, lng: 121.438 },
  ]);

  const responder = created.markers.find((marker) => marker.options.zIndex === 1400);
  expect(responder.options.position).toEqual({ lat: 12.52, lng: 121.44 });
  expect(created.infoWindows.some((info) => info.options.content === 'Unit Pumper 1')).toBe(true);
  expect(created.infoWindows.some((info) => info.options.content === 'Sitio Langawin')).toBe(true);
  expect(created.maps[0].data.addGeoJson).toHaveBeenCalled();
  expect(created.fits).toHaveLength(1);
});

test('makes the selected pin draggable when the map is used as a location picker', async () => {
  const onLocationSelect = jest.fn();
  render(
    <GoogleMap
      selected={destination}
      markers={[{ id: 7, lat: 12.518, lng: 121.438, address: 'Sitio Langawin' }]}
      onLocationSelect={onLocationSelect}
    />
  );

  await waitFor(() => expect(created.markers.length).toBeGreaterThanOrEqual(2));
  const selectedPin = created.markers.find((marker) => marker.options.draggable);
  expect(selectedPin).toBeDefined();
  selectedPin.listeners.dragend({ latLng: { lat: () => 12.4, lng: () => 121.45 } });
  expect(onLocationSelect).toHaveBeenCalledWith({ latitude: 12.4, longitude: 121.45 });
});

test('falls back to the OpenStreetMap/Leaflet map when Google Maps is unavailable', async () => {
  loadGoogleMaps.mockRejectedValue(new Error('no key'));
  render(<GoogleMap destination={destination} />);
  expect(await screen.findByLabelText('Leaflet fallback map')).toBeInTheDocument();
});

test('uses the OpenStreetMap/Leaflet fallback immediately when no Google Maps key is configured', () => {
  hasGoogleMapsKey.mockReturnValue(false);
  render(<GoogleMap destination={destination} />);
  expect(screen.getByLabelText('Leaflet fallback map')).toBeInTheDocument();
  expect(loadGoogleMaps).not.toHaveBeenCalled();
});
