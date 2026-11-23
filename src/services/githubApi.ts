import { GitHubInstallation } from '../types';
import { http } from './http';

// FlowMate GitHub App (FlowMate-BE dev):
//   GET  /api/github/installations?teamId=   -> the team's accounts/orgs with the app installed, with their repos
//   POST /api/github/installations/start     -> { installUrl, expiresAt } (signed state, ~10 min)
//   POST /api/github/installations/complete  -> { state, installationId } after GitHub redirects back (204)
// GitHub sends the user back to {web app}/github/install/callback?installation_id=..&state=..; the
// app then calls complete so the server saves the installation (see services/githubInstall.ts).

interface RepositoryDto {
  id: number;
  owner: string | null;
  name: string | null;
  fullName: string | null;
  htmlUrl: string | null;
  privateRepository: boolean;
}
interface InstallationDto {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  repositories: RepositoryDto[] | null;
}

export const toInstallation = (dto: InstallationDto): GitHubInstallation => ({
  installationId: String(dto.installationId),
  accountLogin: dto.accountLogin || `installation ${dto.installationId}`,
  accountType: dto.accountType || '',
  repositories: (dto.repositories || [])
    .filter((r) => r.owner && r.name)
    .map((r) => ({
      id: String(r.id),
      owner: r.owner!,
      name: r.name!,
      fullName: r.fullName || `${r.owner}/${r.name}`,
      htmlUrl: r.htmlUrl || '',
      private: Boolean(r.privateRepository),
    })),
});

export const githubApi = {
  getInstallations: async (teamId: string): Promise<GitHubInstallation[]> => {
    // The backend asks GitHub for each installation's repos: allow more than the default timeout
    const res = await http<{ installations?: InstallationDto[] }>(
      `/api/github/installations?${new URLSearchParams({ teamId })}`,
      { timeoutMs: 30000 }
    );
    return (res?.installations || []).map(toInstallation);
  },
  // teamId goes along so the server can tie the install to the team (ignored if it doesn't need it)
  startInstallation: async (teamId: string): Promise<{ installUrl: string; expiresAt: string }> =>
    http<{ installUrl: string; expiresAt: string }>(
      `/api/github/installations/start?${new URLSearchParams({ teamId })}`,
      { method: 'POST' }
    ),
  // 204 No Content on success
  completeInstallation: async (state: string, installationId: string): Promise<void> => {
    await http<unknown>('/api/github/installations/complete', {
      method: 'POST',
      json: { state, installationId: Number(installationId) },
    });
  },
};