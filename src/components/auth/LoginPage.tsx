import React from 'react';
import { Github } from 'lucide-react';
import { Button } from '../ui/Button';
import { GITHUB_LOGIN_URL } from '../../services/authApi';
import { useAuthStore } from '../../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const loginError = useAuthStore((s) => s.loginError);
  const beginLogin = useAuthStore((s) => s.beginLogin);

  const handleLogin = () => {
    // Opens the system browser (Electron routes http(s) popups to it). After GitHub approves, the backend
    // redirects to flowmate://oauth/callback, which the Electron main process hands back to this window.
    beginLogin();
    window.open(GITHUB_LOGIN_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background text-text-primary">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-modal p-8 text-center space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">FlowMate</h1>
          <p className="text-xs text-text-secondary mt-1">GitHub 계정으로 로그인하세요.</p>
        </div>
        <Button onClick={handleLogin} className="w-full gap-2">
          <Github className="h-4 w-4" />
          <span>GitHub로 로그인</span>
        </Button>
        {loginError && (
          <p role="alert" className="text-[11px] text-red-500">
            {loginError}
          </p>
        )}
      </div>
    </div>
  );
};
