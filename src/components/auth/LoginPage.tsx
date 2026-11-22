import React from 'react';
import { Github } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const loginError = useAuthStore((s) => s.loginError);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const startLogin = useAuthStore((s) => s.startLogin);

  // The main process opens GitHub login in the system browser. The backend then redirects to
  // flowmate://oauth/callback, which the main process handles; this page only gets ok/error back.
  const handleLogin = () => {
    void startLogin();
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background text-text-primary">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-modal p-8 text-center space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">FlowMate</h1>
          <p className="text-xs text-text-secondary mt-1">GitHub 계정으로 로그인하세요.</p>
        </div>
        {/* Stays clickable: if the browser tab was closed, no result ever comes back */}
        <Button onClick={handleLogin} className="w-full gap-2">
          <Github className="h-4 w-4" />
          <span>GitHub로 로그인</span>
        </Button>
        {isLoggingIn && (
          <p className="text-[11px] text-text-muted">브라우저에서 GitHub 로그인을 완료해주세요.</p>
        )}
        {loginError && (
          <p role="alert" className="text-[11px] text-red-500">
            {loginError}
          </p>
        )}
      </div>
    </div>
  );
};
