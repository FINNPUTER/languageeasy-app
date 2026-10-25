import { store } from './util.js';

(function readApiFromUrl() {
  const u = new URL(location.href);
  const a = u.searchParams.get('api');
  if (a) {
    store('api', a.replace(/\/+$/, ''));
    u.searchParams.delete('api');
    history.replaceState(null, '', u.toString());
  }
})();

export function apiBase() { return store('api') || ''; }
export function setApiBase(v) { store('api', String(v || '').trim().replace(/\/+$/, '')); }
export function token() { return store('token') || ''; }
export function setToken(t) { store('token', t); }

export class AuthError extends Error {}

async function request(method, path, body, opts = {}) {
  const base = apiBase();
  if (!base) throw new AuthError('Server fehlt');
  const headers = { Authorization: 'Bearer ' + token() };
  let payload;
  if (body instanceof Blob) { payload = body; headers['Content-Type'] = body.type || 'audio/webm'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: payload });
  } catch (e) {
    throw new Error('Server nicht erreichbar. Läuft das Backend auf Railway?');
  }
  if (res.status === 401) { setToken(null); throw new AuthError('Bitte neu anmelden'); }
  if (opts.blob) {
    if (!res.ok) throw new Error('Audio konnte nicht geladen werden');
    return res.blob();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler ' + res.status);
  return data;
}

export const api = {
  login: async (password) => {
    const res = await fetch(apiBase() + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
    }).catch(() => { throw new Error('Server nicht erreichbar. Stimmt die Adresse?'); });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Anmeldung fehlgeschlagen');
    setToken(data.token);
    return data;
  },
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  patch: (p, b) => request('PATCH', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
  audio: (p, b) => request('POST', p, b, { blob: true }),
  upload: (p, blob) => request('POST', p, blob)
};
