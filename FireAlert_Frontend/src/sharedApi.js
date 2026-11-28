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

let refreshPromise = null;

function clearStoredAuthSession() {
  localStorage.removeItem('firealert_token');
  localStorage.removeItem('firealert_user');
  localStorage.removeItem('firealert_user_id');
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('firealert:auth-expired'));
  }
}

/**
 * Exchange an existing JWT for a fresh token once across concurrent 401s.
 */
async function refreshAccessToken() {
  const token = localStorage.getItem('firealert_token');
  if (!token) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        const nextToken = data?.data?.access_token;
        if (response.ok && nextToken) {
          localStorage.setItem('firealert_token', nextToken);
          return nextToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('firealert_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const { _retried = false, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && token && !_retried && !String(path).startsWith('/auth/')) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiRequest(path, { ...options, _retried: true });
    }
    clearStoredAuthSession();
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationErrors = payload.errors
      ? Object.values(payload.errors).flat().join(' ')
      : '';
    const contentType = response.headers?.get?.('content-type') || '';
    const fallbackMessage = contentType && !contentType.toLowerCase().includes('json')
      ? `Server returned HTTP ${response.status}. Please refresh or try again.`
      : `Request failed: ${response.status}`;
    throw new Error(validationErrors || payload.message || fallbackMessage);
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
