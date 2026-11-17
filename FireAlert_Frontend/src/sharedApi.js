function resolveApiBaseUrl() {
  const configured = (process.env.REACT_APP_API_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (process.env.NODE_ENV === 'production') return '/api/v1';

  // In development, point at the API on the same host the page was opened
  // from. This follows the machine's current Wi-Fi/hotspot address, so a
  // phone on the LAN can reach the API without a hard-coded private IP.
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }

  return 'http://localhost:8000/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('firealert_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationErrors = payload.errors
      ? Object.values(payload.errors).flat().join(' ')
      : '';
    throw new Error(validationErrors || payload.message || `Request failed: ${response.status}`);
  }

  return payload;
}

export function normalizeReports(payload) {
  const reports = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  return reports.map(normalizeReport);
}

export function normalizeReport(payload) {
  const report = payload?.data || payload;
  if (!report?.attributes) return report || null;

  return {
    id: report.id,
    ...report.attributes,
    residentName: report.includes?.resident?.attributes?.name || null,
    dispatch: payload?.dispatch || report.dispatch || null,
  };
}

export { API_BASE_URL };
