import React from 'react';
import { ExternalLink, Github } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const loginError = useAuthStore((s) => s.loginError);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const startLogin = useAuthStore((s) => s.startLogin);
  const isDesktop = Boolean(window.electronAPI?.isElectron);

  // Desktop: the main process opens GitHub login in the system browser and handles the callback.
  // Web: navigates to GitHub and comes back to /oauth/callback.
  const handleLogin = () => {
    void startLogin();
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background text-text-primary">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-modal p-8 text-center space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">FlowMate</h1>
          <p className="text-xs text-text-secondary mt-1">GitHub 계정으로 로그인하세요.</p>
          <p className="text-[11px] text-text-muted mt-1">
            처음이라면 GitHub 로그인 후 닉네임만 정하면 가입이 끝납니다.
          </p>
        </div>

        {/* Stays clickable: if the browser tab was closed, no result ever comes back */}
        <Button onClick={handleLogin} className="w-full gap-2">
          <Github className="h-4 w-4" />
          <span>GitHub로 로그인</span>
        </Button>
        {isLoggingIn && isDesktop && (
          <p className="text-[11px] text-text-muted">
            브라우저에서 GitHub 로그인을 완료해주세요. 로그인 후 브라우저에 "FlowMate 앱으로 돌아가기"가 보이면 눌러주세요.
          </p>
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
