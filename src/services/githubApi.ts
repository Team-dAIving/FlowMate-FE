import { GitHubInstallation } from '../types';
import { http } from './http';

// FlowMate GitHub App (FlowMate-BE dev):
//   GET  /api/github/installations        -> accounts/orgs where I installed the app, with their repos
//   POST /api/github/installations/start  -> { installUrl, expiresAt } (signed state, ~10 min)
// The backend learns about a new installation from GitHub's webhook, so a fresh install can take
// a moment to show up in the list.

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
  getInstallations: async (): Promise<GitHubInstallation[]> => {
    // The backend asks GitHub for each installation's repos: allow more than the default timeout
    const res = await http<{ installations?: InstallationDto[] }>('/api/github/installations', { timeoutMs: 30000 });
    return (res?.installations || []).map(toInstallation);
  },

  startInstallation: async (): Promise<{ installUrl: string; expiresAt: string }> =>
    http<{ installUrl: string; expiresAt: string }>('/api/github/installations/start', { method: 'POST' }),
};
