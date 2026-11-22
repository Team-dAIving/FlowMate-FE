import { create } from 'zustand';
import { authApi } from '../services/authApi';
import { ApiError, setUnauthorizedHandler } from '../services/http';
import type { AuthResult } from '../types/electron';

// The JWT lives only in the Electron main process (encrypted with safeStorage, attached to API requests
// there). This store only knows whether a session exists and whether onboarding is pending.

export type AuthStatus = 'checking' | 'loggedOut' | 'onboarding' | 'ready';

interface AuthState {
  status: AuthStatus;
  loginError: string | null;
  isLoggingIn: boolean;
  /** Restores the session on startup. Call once. */
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
const DESKTOP_ONLY = '로그인은 FlowMate 데스크톱 앱에서만 가능합니다.';

export const useAuthStore = create<AuthState>((set, get) => {
  const electronAuth = () => window.electronAPI?.auth;

  const clearLocal = async () => {
    try {
      await electronAuth()?.clear();
    } catch (err) {
      console.error('Failed to clear the session:', err);
    }
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
  setUnauthorizedHandler(() => {
    if (get().status !== 'loggedOut') void clearLocal();
  });

  // Login results come from the main process after the browser round trip (ok/error only, no token)
  electronAuth()?.onResult((result: AuthResult) => {
    if (result.ok) {
      void loadMe();
    } else {
      set({ isLoggingIn: false, loginError: LOGIN_ERROR });
    }
  });

  return {
    status: 'checking',
    loginError: null,
    isLoggingIn: false,

    init: async () => {
      const ea = electronAuth();
      if (!ea) {
        set({ status: 'loggedOut', loginError: DESKTOP_ONLY });
        return;
      }
      try {
        const { loggedIn } = await ea.getState();
        if (loggedIn) await loadMe();
        else set({ status: 'loggedOut' });
      } catch (err) {
        console.error('Failed to restore the session:', err);
        set({ status: 'loggedOut' });
      }
    },

    startLogin: async () => {
      const ea = electronAuth();
      if (!ea) {
        set({ loginError: DESKTOP_ONLY });
        return;
      }
      set({ isLoggingIn: true, loginError: null });
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
