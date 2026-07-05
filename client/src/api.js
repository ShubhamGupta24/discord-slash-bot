const API_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'bot-console-token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    // ignore — session just won't persist across reloads
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // ignore
  }
}

async function request(path, options = {}) {
  const token = getToken();
  console.log('[api] request', { path, method: options.method || 'GET', hasToken: Boolean(token) });
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired — please log in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log('[api] request failed', { path, status: res.status, body });
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  const data = await res.json();
  console.log('[api] response', { path, data });
  return data;
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getLogs: () => request('/api/logs'),
  getConfig: () => request('/api/config'),
  saveConfig: (commandName, flaggedKeywords) =>
    request('/api/config', {
      method: 'POST',
      body: JSON.stringify({ commandName, flaggedKeywords }),
    }),
};
