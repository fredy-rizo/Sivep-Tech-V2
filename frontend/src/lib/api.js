const API_URL = import.meta.env.VITE_API_URL || '/api';
export const TOKEN_KEY = 'sivep.token';
export const TENANT_KEY = 'sivep.tenant';
export const SESSION_KEY = 'sivep.user';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveSession({ token, user, tenant }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  if (tenant) localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TENANT_KEY);
}

export function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function readStoredTenant() {
  try {
    return JSON.parse(localStorage.getItem(TENANT_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const { method = 'GET', body, token = getToken(), tenantSlug } = options;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantSlug) headers['x-tenant'] = tenantSlug;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error;
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('sivep:unauthorized'));
    }
    throw new ApiError(
      error?.message || 'No se pudo completar la solicitud',
      response.status,
      error?.code,
      error?.details,
    );
  }

  return payload;
}

export function queryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}
