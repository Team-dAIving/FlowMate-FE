import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  completeGitHubInstall,
  getInstallTeam,
  installCallbackDeepLink,
  parseInstallCallback,
  rememberInstallResumeTeam,
  takeInstallTeam,
} from '../../services/githubInstall';
import { webToken } from '../../services/webAuth';

type Status = 'completing' | 'opening-desktop' | 'invalid' | 'failed';

const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'GitHub 앱 설치 정보를 저장하지 못했습니다.';

/** Real route for the Setup URL configured in the GitHub App. */
export const GitHubInstallCallbackPage: React.FC = () => {
  const callback = useMemo(() => parseInstallCallback(window.location.search), []);
  const [status, setStatus] = useState<Status>(() =>
    callback.kind === 'invalid' ? 'invalid' : webToken.get() ? 'completing' : 'opening-desktop'
  );
  const [message, setMessage] = useState('');
  const started = useRef(false);

  const deepLink = callback.kind === 'install' ? installCallbackDeepLink(callback) : '';

  const openDesktop = () => {
    if (deepLink) window.location.assign(deepLink);
  };

  const completeInBrowser = async () => {
    if (callback.kind !== 'install') return;
    setStatus('completing');
    setMessage('');
    try {
      await completeGitHubInstall(callback);
      rememberInstallResumeTeam(takeInstallTeam());
      window.location.replace('/');
    } catch (err) {
      console.error('GitHub install complete failed:', err);
      setMessage(errorText(err));
      setStatus('failed');
    }
  };

  useEffect(() => {
    if (started.current || callback.kind === 'invalid') return;
    started.current = true;
    if (webToken.get()) void completeInBrowser();
    else openDesktop();
  }, [callback]);

  const title =
    status === 'completing'
      ? 'GitHub 연결을 저장하는 중입니다'
      : status === 'opening-desktop'
        ? 'FlowMate 앱으로 돌아가세요'
        : status === 'invalid'
          ? '올바르지 않은 GitHub 콜백입니다'
          : 'GitHub 연결을 저장하지 못했습니다';

  return (
    <main className="min-h-screen bg-background text-text-primary flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-sm space-y-4">
        <h1 className="text-base font-semibold">{title}</h1>
        {status === 'completing' && <p className="text-xs text-text-muted">창을 닫지 말고 잠시만 기다려주세요.</p>}
        {status === 'opening-desktop' && (
          <>
            <p className="text-xs text-text-muted">자동으로 열리지 않으면 아래 버튼을 눌러주세요.</p>
            <button type="button" onClick={openDesktop} className="rounded-md bg-primary px-4 py-2 text-xs text-white">
              FlowMate 열기
            </button>
          </>
        )}
        {status === 'invalid' && <p className="text-xs text-red-500">설치를 다시 시작해주세요.</p>}
        {status === 'failed' && (
          <>
            <p className="text-xs text-red-500">{message}</p>
            {getInstallTeam() ? (
              <button type="button" onClick={() => void completeInBrowser()} className="rounded-md bg-primary px-4 py-2 text-xs text-white">
                다시 시도
              </button>
            ) : (
              <a href="/" className="inline-block rounded-md bg-primary px-4 py-2 text-xs text-white">FlowMate로 돌아가기</a>
            )}
          </>
        )}
      </section>
    </main>
  );
};
