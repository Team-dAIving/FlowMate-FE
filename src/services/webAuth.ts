// Web (browser) login. The desktop app never uses this: there the JWT lives in the Electron main process.
//
// Flow: "GitHub로 로그인" -> {API}/oauth2/authorization/github?client=web&state=<random>
//       -> GitHub -> backend -> {this web app}/oauth/callback?accessToken=...|code=...&onboardingRequired=...&state=...
//
// A browser has no place a script can't read, so the token is kept in sessionStorage: per tab,
// gone when the tab closes, never in localStorage. (Moving the web session to an HttpOnly cookie
// on the backend would remove even that; see the note at the end of this file.)

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export const WEB_CALLBACK_PATH = '/oauth/callback';
const TOKEN_KEY = 'flowmate_web_token';
const PENDING_KEY = 'flowmate_web_login'; // { state, at } of the login this tab started
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const CODE_SHAPE = /^[A-Za-z0-9._~-]{8,512}$/;

const session = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch {
      // storage disabled: the session just won't survive a reload
    }
  },
};

// In-memory copy so a disabled sessionStorage still works for the current page
let memoryToken: string | null = session.get(TOKEN_KEY);

export const webToken = {
  get: () => memoryToken,
  set: (t: string) => {
    memoryToken = t;
    session.set(TOKEN_KEY, t);
  },
  clear: () => {
    memoryToken = null;
    session.set(TOKEN_KEY, null);
  },
};

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Leaves the page for the GitHub login. */
export function startWebLogin(): void {
  const state = randomState();
  session.set(PENDING_KEY, JSON.stringify({ state, at: Date.now() }));
  const q = new URLSearchParams({ client: 'web', state });
  window.location.assign(`${BASE_URL}/oauth2/authorization/github?${q.toString()}`);
}

export type WebCallback =
  | { kind: 'none' }
  | { kind: 'error'; error: string }
  | { kind: 'token'; accessToken: string; onboardingRequired: boolean }
  | { kind: 'code'; code: string }
  // A login result this tab didn't start. The backend sends every login (desktop app included) to one
  // web callback URL, so this is usually the desktop app's login: offer to hand it over (never adopt it here).
  | { kind: 'foreign'; desktopUrl: string };

const DESKTOP_CALLBACK = 'flowmate://oauth/callback';
const RELAY_PARAMS = ['accessToken', 'code', 'onboardingRequired', 'error', 'state'] as const;
const RELAY_VALUE = /^[A-Za-z0-9._~-]{1,2048}$/;

/** flowmate://oauth/callback with only the known login params (validated), for the desktop app. */
function desktopRelayUrl(params: URLSearchParams): string | null {
  const q = new URLSearchParams();
  for (const k of RELAY_PARAMS) {
    const v = params.get(k);
    if (v !== null && RELAY_VALUE.test(v)) q.set(k, v);
  }
  return q.has('accessToken') || q.has('code') || q.has('error') ? `${DESKTOP_CALLBACK}?${q.toString()}` : null;
}

/**
 * If this page load is the OAuth redirect, reads it once and removes it from the address bar/history.
 * Only accepts a callback for a login started in this tab (state match, or within the time window if
 * the backend doesn't echo state yet) — otherwise anyone could log you into their account with a link.
 */
export function consumeWebCallback(): WebCallback {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  const isCallback =
    pathname === WEB_CALLBACK_PATH || params.has('accessToken') || params.has('code') || params.has('error');
  if (!isCallback) return { kind: 'none' };

  // Never leave a token or code in the URL, history, or a bookmark
  window.history.replaceState(null, '', '/');

  let pending: { state?: string; at?: number } = {};
  try {
    pending = JSON.parse(session.get(PENDING_KEY) || '{}');
  } catch {
    // ignore
  }
  session.set(PENDING_KEY, null); // single use

  const state = params.get('state');
  const started = typeof pending.at === 'number' && Date.now() - pending.at <= LOGIN_WINDOW_MS;
  const stateOk = state !== null ? state === pending.state : started;
  if (!started || !stateOk) {
    // Not this tab's login: don't log in here (login CSRF). The desktop app decides for itself
    // whether it started a login, so handing the result over is no riskier than a flowmate:// link.
    console.warn('Ignored an OAuth callback this tab did not start.');
    const desktopUrl = desktopRelayUrl(params);
    return desktopUrl ? { kind: 'foreign', desktopUrl } : { kind: 'none' };
  }

  const error = params.get('error');
  if (error) return { kind: 'error', error: error.slice(0, 100) };
  const accessToken = params.get('accessToken') || '';
  if (JWT_SHAPE.test(accessToken)) {
    return { kind: 'token', accessToken, onboardingRequired: params.get('onboardingRequired') === 'true' };
  }
  const code = params.get('code') || '';
  if (CODE_SHAPE.test(code)) return { kind: 'code', code };
  return { kind: 'error', error: 'invalid_callback' };
}

// Note for the backend: the safest web setup is an HttpOnly, Secure, SameSite cookie set by the
// backend at the callback (then the web app never holds the token at all). This module would then
// only need to send requests with credentials: 'include'.
