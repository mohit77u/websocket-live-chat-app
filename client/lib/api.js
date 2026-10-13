import { API_BASE } from './config';

export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.field = extra.field || null; // 409 duplicate: kaunsa field
    this.fields = extra.fields || null; // 400 validation: field -> message
  }
}

let token = null;
let onUnauthorized = null;

export function setApiToken(t) {
  token = t;
}

// 401 (expired/invalid token) par AuthProvider logout karwata hai
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    // login/signup ka 401 "galat password" hai, session expiry nahi
    if (res.status === 401 && auth && token) onUnauthorized?.();
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data || {});
  }
  return data;
}
