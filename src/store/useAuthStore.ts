import { create } from 'zustand';
import { authApi } from '../services/authApi';
import { ApiError, setUnauthorizedHandler, setWebTokenProvider } from '../services/http';
import { consumeWebCallback, startWebLogin, webToken } from '../services/webAuth';
import type { AuthResult } from '../types/electron';
import { resetSessionData } from './resetSessionData';

// Login works in both the desktop app and the browser:
// - Desktop: the JWT lives only in the Electron main process (safeStorage, header attached there).
// - Web: services/webAuth.ts keeps it for the tab (sessionStorage) and http.ts attaches it.
// This store only knows whether a session exists and whether onboarding is pending.

export type AuthStatus = 'checking' | 'loggedOut' | 'onboarding' | 'ready';

interface AuthState {
  status: AuthStatus;
  loginError: string | null;
  isLoggingIn: boolean;
  /** Restores the session on startup (and finishes a web login redirect). Call once. */
  init: () => Promise<void>;
  startLogin: () => Promise<void>;
  submitNickname: (nickname: string) => Promise<void>;
  /** Tells the server, then drops the local session (dropped even if the call fails). */
  logout: () => Promise<void>;
}

// Older versions kept the token in localStorage; remove anything left behind.
for (const key of ['flowmate_access_token', 'flowmate_needs_nickname', 'flowmate_login_started_at']) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const LOGIN_ERROR = 'GitHub 로그인에 실패했습니다. 다시 시도해주세요.';

// Web requests carry the tab's token; on desktop http.ts ignores this provider
setWebTokenProvider(() => webToken.get());

export const useAuthStore = create<AuthState>((set, get) => {
  const electronAuth = () => window.electronAPI?.auth;
  let initPromise: Promise<void> | null = null;

  const clearLocal = async () => {
    const ea = electronAuth();
    try {
      if (ea) await ea.clear();
      else webToken.clear();
    } catch (err) {
      console.error('Failed to clear the session:', err);
    }
    resetSessionData();
    set({ status: 'loggedOut', isLoggingIn: false });
  };

  /** Asks the server who we are; decides between onboarding and the app. */
  const loadMe = async () => {
    try {
      const me = await authApi.getMe();
      set({ status: me.onboardingRequired ? 'onboarding' : 'ready', loginError: null, isLoggingIn: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Handle it here too: right after a login the status is still 'loggedOut', so the global
        // 401 handler skips it, and the rejected token would otherwise stay stored.
        await clearLocal();
        set({ loginError: '로그인 정보가 유효하지 않습니다. 다시 로그인해주세요.' });
      } else {
        console.error('Failed to load the current user:', err);
        set({ status: 'loggedOut', isLoggingIn: false, loginError: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' });
      }
    }
  };

  // The server rejected the session: forget it and show the login screen
  // The server rejected the session (the JWT lasts 1 hour and there is no refresh API): say why
  setUnauthorizedHandler(() => {
    if (get().status === 'loggedOut') return;
    void clearLocal().then(() => set({ loginError: '로그인이 만료되었습니다. 다시 로그인해주세요.' }));
  });

  // Desktop: login results come from the main process after the browser round trip (ok/error only, no token)
  electronAuth()?.onResult((result: AuthResult) => {
    if (result.ok) {
      void loadMe();
    } else {
      set({ isLoggingIn: false, loginError: LOGIN_ERROR });
    }
  });

  /** Web: this page load may be the OAuth redirect back from the backend. */
  const finishWebRedirect = async () => {
    const cb = consumeWebCallback();
    if (cb.kind === 'error') {
      set({ loginError: LOGIN_ERROR });
    } else if (cb.kind === 'code') {
      try {
        const { accessToken } = await authApi.exchangeCode(cb.code, 'web');
        webToken.set(accessToken);
      } catch (err) {
        console.error('Code exchange failed:', err);
        set({ loginError: LOGIN_ERROR });
      }
    }
  };

  return {
    status: 'checking',
    loginError: null,
    isLoggingIn: false,

    init: () => {
      // React StrictMode runs effects twice in dev; the OAuth redirect must only be consumed once
      if (!initPromise) {
        initPromise = (async () => {
          try {
            const ea = electronAuth();
            if (ea) {
              const { loggedIn } = await ea.getState();
              if (loggedIn) await loadMe();
              else set({ status: 'loggedOut' });
            } else {
              await finishWebRedirect();
              if (webToken.get()) await loadMe();
              else set({ status: 'loggedOut' });
            }
          } catch (err) {
            console.error('Failed to restore the session:', err);
            set({ status: 'loggedOut' });
          }
        })();
      }
      return initPromise;
    },

    startLogin: async () => {
      set({ isLoggingIn: true, loginError: null });
      const ea = electronAuth();
      if (!ea) {
        startWebLogin(); // navigates away to GitHub
        return;
      }
      try {
        const res = await ea.startLogin();
        if (!res.ok) set({ isLoggingIn: false, loginError: res.message || LOGIN_ERROR });
      } catch (err) {
        console.error('Failed to start login:', err);
        set({ isLoggingIn: false, loginError: LOGIN_ERROR });
      }
    },

    submitNickname: async (nickname) => {
      const me = await authApi.setNickname(nickname);
      set({ status: me.onboardingRequired ? 'onboarding' : 'ready' });
    },

    logout: async () => {
      try {
        await authApi.logout();
      } catch (err) {
        console.error('Logout request failed:', err);
      }
      await clearLocal();
    },
  };
});
