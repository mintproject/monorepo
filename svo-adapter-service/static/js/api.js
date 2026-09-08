// api.js - API client
let TOKEN = null;

export function setToken(t) {
  TOKEN = t || null;
  try { t ? sessionStorage.setItem('jwt', t) : sessionStorage.removeItem('jwt'); } catch {}
}

export function getToken() {
  return TOKEN;
}

export async function api(method, path, body, options = {}) {
  const opts = { method, headers: {} };
  if (options.auth && TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  const txt = await r.text();
  let d;
  try { d = txt ? JSON.parse(txt) : null; } catch { d = txt; }
  if (!r.ok) throw new Error(d?.detail ? (typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)) : `HTTP ${r.status}`);
  return d;
}

export function restoreToken() {
  try { TOKEN = sessionStorage.getItem('jwt') || null; } catch {}
  return TOKEN;
}