import React from 'react';
import { USE_REAL_API } from '../../services/http';
import { useAuthStore } from '../../store/useAuthStore';
import { LoginPage } from './LoginPage';
import { NicknameDialog } from './NicknameDialog';

/**
 * Login gate for the real backend (JWT in the Authorization header).
 * Without VITE_API_BASE_URL the app runs on local mock data and skips login.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const needsNickname = useAuthStore((s) => s.needsNickname);

  if (!USE_REAL_API) return <>{children}</>;
  if (!token) return <LoginPage />;
  // First login: do not enter the app until a nickname is set
  if (needsNickname) return <NicknameDialog />;
  return <>{children}</>;
};
