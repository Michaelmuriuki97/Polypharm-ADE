// In production, use the Vercel same-origin /api rewrite so session cookies
// remain first-party. Keep the direct FastAPI URL for local development.
const API_BASE = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE || 'http://localhost:8000'
  : '';
  

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the backend at ${API_BASE}. Make sure FastAPI is running.`
    );
  }

  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : 'Request failed. Please try again.'
    );
  }
  return body;
}

export const authApi = {
  signup: payload =>
    request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: payload =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request('/api/auth/me'),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  forgotPassword: payload =>
    request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetPassword: payload =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAccount: payload =>
    request('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }),
};

export const clinicalApi = {
  health: () => request('/api/clinical/health'),

  analyze: payload =>
    request('/api/clinical/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  askAssistant: payload =>
    request('/api/clinical/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
