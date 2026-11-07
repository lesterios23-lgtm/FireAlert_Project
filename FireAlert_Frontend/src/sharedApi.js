const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('firealert_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
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
  };
}

export { API_BASE_URL };
