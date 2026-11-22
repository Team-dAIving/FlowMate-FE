// Main-process auth: the JWT never reaches the renderer.
// - The OAuth callback (flowmate://oauth/callback?accessToken=... or ?code=...) is parsed here.
// - The token is kept in memory and persisted encrypted with safeStorage (OS key store).
// - "Authorization: Bearer" is attached here, only to requests for the API origin.
// So an XSS in the renderer can at worst make requests while the app is open; it can't read the token.
const { app, net, safeStorage, session, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// header.payload.signature, base64url
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
// One-time login code (if the backend uses the code flow): URL-safe, bounded length
const CODE_SHAPE = /^[A-Za-z0-9._~-]{8,512}$/;

/** GitHub login entry point. `client` tells the backend where to send the user back. */
function loginUrl(base, client, state) {
  const q = new URLSearchParams({ client, state });
  return `${base}/oauth2/authorization/github?${q.toString()}`;
}

/** POST /api/auth/token { code, client } -> { accessToken, onboardingRequired } (one-time code flow). */
async function exchangeCode(base, code, client) {
  const res = await net.fetch(`${base}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ code, client }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body || typeof body.accessToken !== 'string' || !JWT_SHAPE.test(body.accessToken)) {
    throw new Error('response has no valid accessToken');
  }
  return { accessToken: body.accessToken, onboardingRequired: body.onboardingRequired === true };
}
// The GitHub login must finish within this window after the user clicks login in this app
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const TOKEN_FILE = 'auth-token.bin';

/**
 * API base URL from the same place the renderer gets it (VITE_API_BASE_URL):
 * dev reads the .env files through Vite, a packaged build reads dist/flowmate-config.json written at build time.
 */
async function loadApiOrigin(isDev, appRoot) {
  let raw = '';
  try {
    if (isDev) {
      const { loadEnv } = await import('vite');
      raw = loadEnv('development', appRoot, 'VITE_').VITE_API_BASE_URL || '';
    } else {
      const file = path.join(appRoot, 'dist', 'flowmate-config.json');
      raw = JSON.parse(fs.readFileSync(file, 'utf8')).apiBaseUrl || '';
    }
  } catch (err) {
    console.error('[auth] could not read the API base URL:', err.message);
  }
  raw = String(raw).trim().replace(/\/+$/, '');
  if (!raw) return null; // mock mode
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('not http(s)');
    if (u.protocol === 'http:' && !isDev && !['localhost', '127.0.0.1'].includes(u.hostname)) {
      // Never send a bearer token over plain http to a remote host in a release build
      throw new Error('a release build needs an https API URL');
    }
    return { base: raw, origin: u.origin };
  } catch (err) {
    console.error(`[auth] invalid VITE_API_BASE_URL "${raw}": ${err.message}`);
    return null;
  }
}

// ---- safeStorage (async API; the sync one is deprecated in Electron 45 and removed in 46) ----
async function canEncrypt() {
  // On Linux without a keyring, safeStorage falls back to a hardcoded key: treat that as unavailable
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') return false;
  return safeStorage.isAsyncEncryptionAvailable();
}
const encrypt = (text) => safeStorage.encryptStringAsync(text);
async function decrypt(buf) {
  const { result } = await safeStorage.decryptStringAsync(buf);
  return result;
}

function createAuth({ isDev, appRoot, getMainWebContents }) {
  let api = null; // { base, origin }
  let token = null;
  let pendingLoginAt = 0;
  let pendingState = null;
  const tokenPath = () => path.join(app.getPath('userData'), TOKEN_FILE);

  const removeTokenFile = () => {
    try {
      fs.rmSync(tokenPath(), { force: true });
    } catch (err) {
      console.error('[auth] could not delete the saved session:', err.message);
    }
  };

  // Writes the CURRENT token to disk. Runs are serialized, and each run re-checks the token after the
  // async encrypt, so a logout that happens mid-write can never be followed by the old token being written.
  async function writeCurrentToken() {
    const value = token;
    if (!value || !(await canEncrypt())) {
      // Logged out, or no secure storage (memory only; never write plaintext): make sure no old file remains
      removeTokenFile();
      return;
    }
    const encrypted = await encrypt(value);
    if (token !== value) return; // changed meanwhile; the run queued by that change writes the new state
    const tmp = `${tokenPath()}.tmp`;
    fs.writeFileSync(tmp, encrypted, { mode: 0o600 });
    fs.renameSync(tmp, tokenPath()); // atomic replace: never a half-written file
  }
  let writeQueue = Promise.resolve();
  function persist() {
    writeQueue = writeQueue
      .then(writeCurrentToken)
      .catch((err) => console.error('[auth] could not save the session:', err.message));
    return writeQueue;
  }

  async function restore() {
    try {
      if (!fs.existsSync(tokenPath()) || !(await canEncrypt())) return;
      const value = await decrypt(fs.readFileSync(tokenPath()));
      if (JWT_SHAPE.test(value)) token = value;
      else removeTokenFile();
    } catch (err) {
      console.error('[auth] could not restore the session, discarding it:', err.message);
      removeTokenFile();
    }
  }

  function attachAuthHeader() {
    // '<all_urls>' + an exact origin check: match patterns don't reliably handle ports (localhost:8080)
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
      const wc = getMainWebContents();
      let sameOrigin = false;
      try {
        sameOrigin = Boolean(api) && new URL(details.url).origin === api.origin;
      } catch {
        // ignore
      }
      // CORS preflights carry no credentials; redirects to another origin fail the origin check
      if (!token || !sameOrigin || details.method === 'OPTIONS' || !wc || details.webContentsId !== wc.id) {
        callback({});
        return;
      }
      // Replace any Authorization the page set itself, whatever its casing, so ours is the only one
      const requestHeaders = {};
      for (const [k, v] of Object.entries(details.requestHeaders)) {
        if (k.toLowerCase() !== 'authorization') requestHeaders[k] = v;
      }
      requestHeaders.Authorization = `Bearer ${token}`;
      callback({ requestHeaders });
    });
  }

  // Never rejects: any failure degrades to "no API / logged out" so the app window still opens
  const ready = (async () => {
    await app.whenReady(); // safeStorage, userData and session are only usable after ready
    try {
      api = await loadApiOrigin(isDev, appRoot);
      if (api) await restore();
    } catch (err) {
      console.error('[auth] init failed, continuing logged out:', err.message);
      token = null;
    }
    try {
      attachAuthHeader();
    } catch (err) {
      console.error('[auth] could not install the auth header hook:', err.message);
      api = null; // without the hook, requests would go out unauthenticated; treat as not configured
    }
  })();

  return {
    ready,

    getState: async () => {
      await ready;
      return { loggedIn: Boolean(token), apiConfigured: Boolean(api) };
    },

    startLogin: async () => {
      await ready;
      if (!api) return { ok: false, message: 'API 서버 주소(VITE_API_BASE_URL)가 설정되지 않았습니다.' };
      pendingLoginAt = Date.now();
      // client: where the backend should send the user back (desktop -> flowmate://oauth/callback)
      // state: random, echoed back by the backend; proves the callback belongs to this login
      pendingState = crypto.randomBytes(24).toString('base64url');
      try {
        await shell.openExternal(loginUrl(api.base, 'desktop', pendingState));
      } catch (err) {
        pendingLoginAt = 0;
        pendingState = null;
        console.error('[auth] could not open the browser:', err.message);
        return { ok: false, message: '브라우저를 열지 못했습니다. 기본 브라우저 설정을 확인해주세요.' };
      }
      return { ok: true };
    },

    /** Returns the result to show the renderer, or null when the callback is ignored. */
    handleCallback: async (rawUrl) => {
      await ready;
      // Login CSRF guard: anything can open flowmate://oauth/callback?accessToken=<attacker token>.
      // Only accept it for a login started from this app moments ago, and only once.
      if (!pendingLoginAt || Date.now() - pendingLoginAt > LOGIN_WINDOW_MS) {
        pendingLoginAt = 0;
        console.warn('[auth] ignored an OAuth callback this app did not start');
        return null;
      }
      let params;
      try {
        params = new URL(rawUrl).searchParams;
      } catch {
        return null; // malformed: ignore without consuming, so it can't cancel the real callback
      }
      // Once the backend echoes `state`, a mismatch means the link isn't from this login
      const state = params.get('state');
      if (state !== null && state !== pendingState) {
        console.warn('[auth] ignored an OAuth callback with a foreign state');
        return null;
      }
      const error = params.get('error');
      const accessToken = params.get('accessToken') || '';
      const code = params.get('code') || '';
      if (!error && !JWT_SHAPE.test(accessToken) && !CODE_SHAPE.test(code)) {
        console.warn('[auth] ignored an OAuth callback without a valid token or code');
        return null; // same: a junk link must not cancel the login in progress
      }
      // A real outcome (success or the backend's error): consume the login so it can't be replayed
      pendingLoginAt = 0;
      pendingState = null;
      if (error) return { ok: false, error: error.slice(0, 100) };

      let jwt = accessToken;
      let onboardingRequired = params.get('onboardingRequired') === 'true';
      if (!JWT_SHAPE.test(jwt)) {
        // One-time code flow: trade it for the JWT here, so the token still never reaches the renderer
        try {
          const exchanged = await exchangeCode(api.base, code, 'desktop');
          jwt = exchanged.accessToken;
          onboardingRequired = exchanged.onboardingRequired;
        } catch (err) {
          console.error('[auth] code exchange failed:', err.message);
          return { ok: false, error: 'code_exchange_failed' };
        }
      }

      token = jwt;
      await persist();
      return { ok: true, onboardingRequired };
    },

    clear: async () => {
      await ready;
      token = null;
      pendingLoginAt = 0;
      pendingState = null;
      await persist();
    },
  };
}

module.exports = { createAuth };
