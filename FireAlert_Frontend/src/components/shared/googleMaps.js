/**
 * Google Maps loader + shared marker artwork.
 *
 * The map prefers the Google Maps JavaScript API (`REACT_APP_GOOGLE_MAPS_API_KEY`).
 * When no key is configured or the script cannot load, the UI falls back to
 * OpenStreetMap/Leaflet automatically so the system remains usable.
 */

const FIRE_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40" aria-hidden="true">
  <path d="M16 1C7.72 1 1 7.72 1 16c0 10.1 15 23 15 23s15-12.9 15-23C31 7.72 24.28 1 16 1Z"
        fill="#e44335" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <path d="M17.3 8.5c.3 2.6-.9 4.1-2.1 5.4-1.1 1.2-2 2.3-2 4.4a3.1 3.1 0 0 0 6.2 0c0-.5-.1-.9-.3-1.3 1.2.9 2 2.3 2 3.8a5.2 5.2 0 0 1-10.4 0c0-2.4 1.3-4.1 2.8-5.8 1.6-1.7 3.3-3.5 3.8-6.5Z"
        fill="#ffffff"/>
</svg>`;

const ACTIVE_FIRE_PIN_SVG = FIRE_PIN_SVG
  .replace('fill="#e44335"', 'fill="#b5121f"')
  .replace('stroke-width="2"', 'stroke-width="2.5"');

const STATION_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
  <circle cx="17" cy="17" r="15" fill="#172a3e" stroke="#ffffff" stroke-width="2.5"/>
  <text x="17" y="21.5" text-anchor="middle" font-family="Inter, Arial, sans-serif"
        font-size="9" font-weight="800" fill="#ffffff">BFP</text>
</svg>`;

const RESPONDER_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" width="42" height="42" aria-hidden="true">
  <circle cx="21" cy="21" r="19" fill="rgba(217, 79, 66, 0.28)"/>
  <circle cx="21" cy="21" r="13" fill="#d94f42" stroke="#ffffff" stroke-width="2.5"/>
  <text x="21" y="27" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15">🚒</text>
</svg>`;

function svgIcon(svg, width, height, anchorX, anchorY) {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width, height },
    anchor: { x: anchorX, y: anchorY },
  };
}

export function buildFirePinIcon(active = false) {
  return svgIcon(active ? ACTIVE_FIRE_PIN_SVG : FIRE_PIN_SVG, 32, 40, 16, 39);
}

export function buildStationPinIcon() {
  return svgIcon(STATION_PIN_SVG, 34, 34, 17, 17);
}

export function buildResponderPinIcon() {
  return svgIcon(RESPONDER_PIN_SVG, 42, 42, 21, 21);
}

export function googleMapsApiKey() {
  return String(process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '').trim();
}

export function hasGoogleMapsKey() {
  return googleMapsApiKey().length > 0;
}

let loadingPromise = null;

/**
 * Loads the Google Maps JavaScript API once and resolves with `google.maps`.
 * Rejects when no key is configured or the script fails/times out.
 */
export function loadGoogleMaps() {
  if (!hasGoogleMapsKey()) {
    return Promise.reject(new Error('GOOGLE_MAPS_API_KEY_MISSING'));
  }

  if (window.google?.maps?.Map && window.google.maps.event) {
    return Promise.resolve(window.google.maps);
  }

  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      loadingPromise = null;
      reject(new Error('GOOGLE_MAPS_TIMEOUT'));
    }, 15000);

    const callbackName = '__firealertMapsReady';
    window[callbackName] = () => {
      clearTimeout(timeout);
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsApiKey(),
    )}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      clearTimeout(timeout);
      loadingPromise = null;
      reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}

export function coordinatesOf(value) {
  if (value?.latitude == null || value?.longitude == null) {
    const latitude = value?.latitude ?? value?.lat;
    const longitude = value?.longitude ?? value?.lng ?? value?.lon;
    if (latitude == null || longitude == null) return null;
    return pointOf(latitude, longitude);
  }
  return pointOf(value.latitude, value.longitude);
}

function pointOf(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

export function routeCoordinates(route) {
  if (!Array.isArray(route)) return [];

  return route
    .map((point) => {
      if (Array.isArray(point)) {
        return coordinatesOf({ latitude: point[0], longitude: point[1] });
      }
      return coordinatesOf(point);
    })
    .filter(Boolean);
}
