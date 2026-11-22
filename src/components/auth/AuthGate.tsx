import React, { useEffect } from 'react';
import { USE_REAL_API } from '../../services/http';
import { useAuthStore } from '../../store/useAuthStore';
import { LoginPage } from './LoginPage';
import { NicknameDialog } from './NicknameDialog';

/**
 * Login gate for the real backend. The JWT itself is held by the Electron main process.
 * Without VITE_API_BASE_URL the app runs on local mock data and skips login.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    if (USE_REAL_API) void init();
  }, [init]);

  if (!USE_REAL_API) return <>{children}</>;
  if (status === 'checking') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-xs text-text-muted">
        로그인 정보를 확인하는 중…
      </div>
    );
  }
  if (status === 'loggedOut') return <LoginPage />;
  // First login: do not enter the app until a nickname is set
  if (status === 'onboarding') return <NicknameDialog />;
  return <>{children}</>;
};
