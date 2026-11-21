import { create } from 'zustand';
import { authApi, parseOAuthCallback } from '../services/authApi';
import { setAuthTokenProvider, setUnauthorizedHandler } from '../services/http';

const TOKEN_KEY = 'flowmate_access_token';
const NEEDS_NICKNAME_KEY = 'flowmate_needs_nickname';
const LOGIN_STARTED_AT_KEY = 'flowmate_login_started_at';
// The GitHub login has to finish within this window after clicking "GitHub로 로그인"
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
// header.payload.signature, base64url
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

interface AuthState {
  token: string | null;
  /** First GitHub login: the user must pick a nickname before using the app. */
  needsNickname: boolean;
  loginError: string | null;
  /** Marks that the user started a GitHub login from this app (required to accept the callback). */
  beginLogin: () => void;
  handleOAuthCallback: (url: string) => void;
  submitNickname: (nickname: string) => Promise<void>;
  /** Tells the server, then drops the local session (the local session is dropped even if the call fails). */
  logout: () => Promise<void>;
}

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (err) {
    console.error('Failed to persist auth state:', err);
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const clearSession = () => {
    writeStorage(TOKEN_KEY, null);
    writeStorage(NEEDS_NICKNAME_KEY, null);
    writeStorage(LOGIN_STARTED_AT_KEY, null);
    set({ token: null, needsNickname: false });
  };

  // Register with the http client; the JWT goes out as a Bearer header.
  setAuthTokenProvider(() => get().token);
  // Token rejected by the server: no point calling /logout, just drop it.
  setUnauthorizedHandler(clearSession);

  // The Electron main process forwards flowmate://oauth/callback?... here after the browser login.
  window.electronAPI?.onOAuthCallback?.((url) => get().handleOAuthCallback(url));

  return {
    token: readStorage(TOKEN_KEY),
    needsNickname: readStorage(NEEDS_NICKNAME_KEY) === 'true',
    loginError: null,

    beginLogin: () => {
      writeStorage(LOGIN_STARTED_AT_KEY, String(Date.now()));
      set({ loginError: null });
    },

    handleOAuthCallback: (url) => {
      const result = parseOAuthCallback(url);
      if (!result) return;

      // Login CSRF guard: any app or web page can open flowmate://oauth/callback?accessToken=<attacker token>.
      // Only accept a callback for a login the user started here recently. Consume the marker either way.
      const startedAt = Number(readStorage(LOGIN_STARTED_AT_KEY));
      writeStorage(LOGIN_STARTED_AT_KEY, null);
      if (!startedAt || Date.now() - startedAt > LOGIN_WINDOW_MS) {
        console.warn('Ignored an OAuth callback that this app did not start.');
        return;
      }

      if (result.error || !result.accessToken || !JWT_SHAPE.test(result.accessToken)) {
        set({ loginError: 'GitHub 로그인에 실패했습니다. 다시 시도해주세요.' });
        return;
      }
      writeStorage(TOKEN_KEY, result.accessToken);
      writeStorage(NEEDS_NICKNAME_KEY, String(result.onboardingRequired));
      set({ token: result.accessToken, needsNickname: result.onboardingRequired, loginError: null });
    },

    submitNickname: async (nickname) => {
      await authApi.setNickname(nickname);
      writeStorage(NEEDS_NICKNAME_KEY, null);
      set({ needsNickname: false });
    },

    logout: async () => {
      try {
        await authApi.logout();
      } catch (err) {
        console.error('Logout request failed:', err);
      }
      clearSession();
    },
  };
});
