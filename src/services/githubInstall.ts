// GitHub App install round trip (web):
//   project form "GitHub 앱 설치" -> rememberInstallTeam(teamId) -> same tab goes to GitHub
//   -> GitHub -> {this web app}/github/install/callback?installation_id=..&setup_action=install&state=..
//   -> takeInstallCallback() -> POST /api/github/installations/complete -> back to the project form
// The same tab is used on purpose: the web login token and the team live in this tab's sessionStorage.

import { api } from './api';

export const INSTALL_CALLBACK_PATH = '/github/install/callback';
const TEAM_KEY = 'flowmate_github_install_team';

export const rememberInstallTeam = (teamId: string) => {
  try {
    sessionStorage.setItem(TEAM_KEY, teamId);
  } catch {
    // storage disabled: the form just opens with the default team
  }
};

/** The team the install was started for (read once). */
export const takeInstallTeam = (): string | undefined => {
  try {
    const v = sessionStorage.getItem(TEAM_KEY);
    sessionStorage.removeItem(TEAM_KEY);
    return v || undefined;
  } catch {
    return undefined;
  }
};

export const isInstallCallbackUrl = () => window.location.pathname === INSTALL_CALLBACK_PATH;

export type InstallCallback =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'install'; state: string; installationId: string };

/**
 * If this page load is GitHub's redirect after installing the app, reads it once and cleans the
 * address bar (no state left in history or bookmarks). The server checks the state.
 */
export function takeInstallCallback(): InstallCallback {
  if (!isInstallCallbackUrl()) return { kind: 'none' };
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', '/');
  const state = params.get('state') || '';
  // GitHub sends installation_id; accept installationId too
  const installationId = params.get('installation_id') || params.get('installationId') || '';
  if (!/^\d{1,20}$/.test(installationId) || !/^[A-Za-z0-9._~+/=-]{1,2048}$/.test(state)) return { kind: 'invalid' };
  return { kind: 'install', state, installationId };
}

// React StrictMode runs effects twice in dev: complete must be called only once per redirect
let finishing: Promise<void> | null = null;

/**
 * Runs once after login on the install redirect: POST complete, then reopen the project form for the
 * team the install was started from (the form loads that team's installations again).
 */
export function finishGitHubInstall(reopen: (teamId: string | undefined) => void): Promise<void> {
  if (finishing) return finishing;
  const cb = takeInstallCallback();
  if (cb.kind === 'none') return Promise.resolve();
  finishing = (async () => {
    const teamId = takeInstallTeam();
    if (cb.kind === 'invalid') {
      window.alert('GitHub에서 돌아온 주소가 올바르지 않아 앱 설치를 저장하지 못했습니다. 다시 설치해주세요.');
    } else {
      try {
        await api.completeGitHubInstallation(cb.state, cb.installationId);
      } catch (err) {
        console.error('GitHub install complete failed:', err);
        const msg = err instanceof Error && err.message ? `\n(${err.message})` : '';
        window.alert(`GitHub 앱 설치 정보를 저장하지 못했습니다.${msg}`);
      }
    }
    reopen(teamId);
  })();
  return finishing;
}
