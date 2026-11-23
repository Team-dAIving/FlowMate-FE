// GitHub App install round trip:
// - Web: the same tab returns to /github/install/callback and calls complete with its web JWT.
// - Desktop: the system browser callback forwards the values to flowmate://github/install/callback;
//   Electron then calls complete with the JWT held by the main process.

import { api } from './api';

export const INSTALL_CALLBACK_PATH = '/github/install/callback';
export const INSTALL_CALLBACK_DEEP_LINK = 'flowmate://github/install/callback';

const TEAM_KEY = 'flowmate_github_install_team';
const RESUME_TEAM_KEY = 'flowmate_github_install_resume_team';

const session = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Storage disabled: completion still works, but the team cannot be restored automatically.
    }
  },
};

export const rememberInstallTeam = (teamId: string) => session.set(TEAM_KEY, teamId);
export const getInstallTeam = (): string | undefined => session.get(TEAM_KEY) || undefined;

export const takeInstallTeam = (): string | undefined => {
  const teamId = getInstallTeam();
  session.set(TEAM_KEY, null);
  return teamId;
};

/** Keeps the selected team across the successful web callback reload. */
export const rememberInstallResumeTeam = (teamId: string | undefined) => {
  if (teamId) session.set(RESUME_TEAM_KEY, teamId);
};

export const takeInstallResumeTeam = (): string | undefined => {
  const teamId = session.get(RESUME_TEAM_KEY) || undefined;
  session.set(RESUME_TEAM_KEY, null);
  return teamId;
};

export const isInstallCallbackUrl = () =>
  window.location.pathname.replace(/\/+$/, '') === INSTALL_CALLBACK_PATH;

export type InstallCallback = { kind: 'invalid' } | { kind: 'install'; state: string; installationId: string };

/**
 * Parses GitHub's callback. State is opaque to the frontend and is validated by the backend.
 */
export function parseInstallCallback(search: string): InstallCallback {
  const params = new URLSearchParams(search);
  const state = params.get('state') || '';
  const installationId = params.get('installation_id') || params.get('installationId') || '';
  if (!/^\d{1,20}$/.test(installationId) || state.length === 0 || state.length > 4096) return { kind: 'invalid' };
  return { kind: 'install', state, installationId };
}

export const installCallbackDeepLink = (callback: Extract<InstallCallback, { kind: 'install' }>) => {
  const query = new URLSearchParams({ installation_id: callback.installationId, state: callback.state });
  return `${INSTALL_CALLBACK_DEEP_LINK}?${query.toString()}`;
};

// GitHub or the OS can deliver the same callback more than once. Deduplicate it in this renderer.
const completing = new Map<string, Promise<void>>();

export function completeGitHubInstall(callback: Extract<InstallCallback, { kind: 'install' }>): Promise<void> {
  const key = `${callback.installationId}:${callback.state}`;
  const existing = completing.get(key);
  if (existing) return existing;
  const request = api.completeGitHubInstallation(callback.state, callback.installationId);
  completing.set(key, request);
  request.catch(() => completing.delete(key));
  return request;
}
