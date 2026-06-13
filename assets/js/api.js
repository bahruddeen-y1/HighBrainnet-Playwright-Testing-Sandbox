// HighBrainnet — shared API client
// Exposes window.HBN.api with: fetch, get, post, patch, del + auth helpers.

(function () {
  const STORAGE_KEY = 'hbn.session';
  const API_BASE = (window.HBN_API_BASE || 'http://localhost:4000') + '/api/v1';

  // ----- session storage -----
  function getSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }
  function isLoggedIn() { return !!getSession()?.accessToken; }
  function currentUser() { return getSession()?.user || null; }

  // ----- client hash for device fingerprint -----
  function clientHash() {
    let h = localStorage.getItem('hbn.clientHash');
    if (!h) {
      h = (Math.random().toString(36) + Date.now().toString(36)).slice(2, 22);
      localStorage.setItem('hbn.clientHash', h);
    }
    return h;
  }

  // ----- fetch core with auto-refresh -----
  async function rawFetch(path, opts = {}, retry = true) {
    const headers = Object.assign({}, opts.headers || {});
    if (!(opts.body instanceof FormData) && opts.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    const session = getSession();
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    const res = await fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)
        ? JSON.stringify(opts.body) : opts.body,
    });

    if (res.status === 401 && retry && session?.refreshToken) {
      const ok = await tryRefresh();
      if (ok) return rawFetch(path, opts, false);
      // refresh failed → force logout
      logout({ redirect: false });
    }

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) data = await res.json();
    else if (res.status !== 204) data = await res.text();

    if (!res.ok) {
      const err = new Error(data?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.details = data?.error?.details;
      throw err;
    }
    return data;
  }

  async function tryRefresh() {
    const s = getSession();
    if (!s?.refreshToken) return false;
    try {
      const r = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken }),
      });
      if (!r.ok) return false;
      const data = await r.json();
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return true;
    } catch { return false; }
  }

  // ----- auth flows -----
  async function login({ email, password }) {
    const data = await rawFetch('/auth/login', {
      method: 'POST',
      body: { email, password, clientHash: clientHash() },
    }, false);
    setSession({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.user;
  }

  async function register(payload) {
    const data = await rawFetch('/auth/register', {
      method: 'POST',
      body: { ...payload, clientHash: clientHash() },
    }, false);
    setSession({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.user;
  }

  async function logout({ redirect = true } = {}) {
    try { await rawFetch('/auth/logout', { method: 'POST' }, false); } catch {}
    setSession(null);
    if (redirect) window.location.href = 'login.html';
  }

  function requireLogin(redirectTo) {
    if (!isLoggedIn()) {
      const back = redirectTo || (location.pathname.split('/').pop() || '');
      location.href = `login.html?back=${encodeURIComponent(back)}`;
      return false;
    }
    return true;
  }

  // ----- convenience -----
  const get   = (path)         => rawFetch(path);
  const post  = (path, body)   => rawFetch(path, { method: 'POST',  body });
  const patch = (path, body)   => rawFetch(path, { method: 'PATCH', body });
  const put   = (path, body)   => rawFetch(path, { method: 'PUT',   body });
  const del   = (path)         => rawFetch(path, { method: 'DELETE' });

  // Download a protected file (xlsx/pdf) — fetch with Bearer then trigger save.
  async function downloadFile(path, filename) {
    const session = getSession();
    const res = await fetch(API_BASE + path, {
      headers: session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` } : {},
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json())?.error?.message || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  window.HBN = window.HBN || {};
  window.HBN.api = {
    BASE: API_BASE,
    get, post, patch, put, del, rawFetch, downloadFile,
    login, register, logout, isLoggedIn, currentUser, getSession, requireLogin,
  };
})();
