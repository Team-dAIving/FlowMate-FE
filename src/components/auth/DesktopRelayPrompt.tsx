import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Web only. The backend sends every GitHub login back to one web URL, including logins the desktop app
 * started. When this tab receives a login it didn't start, it doesn't adopt it (login CSRF); it offers
 * to pass it to the desktop app instead, which accepts it only if it started a login itself.
 */
export const DesktopRelayPrompt: React.FC = () => {
  const desktopRelayUrl = useAuthStore((s) => s.desktopRelayUrl);
  const dismiss = useAuthStore((s) => s.dismissDesktopRelay);
  if (!desktopRelayUrl) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div role="dialog" aria-modal="false" aria-labelledby="relay-title" className="w-full max-w-md p-4 rounded-xl border border-primary/30 bg-surface shadow-modal space-y-2">
        <p id="relay-title" className="text-sm text-text-primary font-semibold">
          데스크톱 앱에서 로그인하셨나요?
        </p>
        <p className="text-xs text-text-secondary">
          이 로그인은 이 브라우저 창에서 시작한 것이 아니어서 여기서는 로그인하지 않았습니다. FlowMate 데스크톱 앱에서
          로그인을 시작했다면 앱으로 돌아가세요.
        </p>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              window.location.href = desktopRelayUrl;
              dismiss();
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>FlowMate 앱으로 돌아가기</span>
          </Button>
          <Button size="sm" variant="outline" onClick={dismiss}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
};
