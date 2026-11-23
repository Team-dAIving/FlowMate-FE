import { GitHubInstallation, Project, ProjectPosition, ProjectRepository, RepoRole } from '../types';

export const REPOS_MAX = 20; // backend limit per project

export const REPO_ROLES: { id: RepoRole; label: string; color: string; max?: number }[] = [
  { id: 'COMMON', label: '공통', color: '#6B7280', max: 1 },
  { id: 'BACKEND', label: '백엔드', color: '#2563EB' },
  { id: 'FRONTEND', label: '프론트엔드', color: '#059669' },
  { id: 'AI', label: 'AI', color: '#7C3AED' },
];

export const repoRoleLabel = (r: RepoRole) => REPO_ROLES.find((x) => x.id === r)?.label ?? r;

const ROLE_SET = new Set<string>(REPO_ROLES.map((r) => r.id));
export const toRepoRole = (value: string | null | undefined): RepoRole => {
  const v = (value || '').trim().toUpperCase();
  return (ROLE_SET.has(v) ? v : 'COMMON') as RepoRole;
};

export function makeRepository(owner: string, name: string, role: RepoRole = 'COMMON'): ProjectRepository {
  return {
    id: `${owner}/${name}`.toLowerCase(),
    role,
    owner,
    name,
    fullName: `${owner}/${name}`,
    htmlUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
  };
}

/** A repo picked from a GitHub App installation, tagged with the part of the project it serves. */
export function repoFromInstallation(
  installation: GitHubInstallation,
  repo: GitHubInstallation['repositories'][number],
  role: RepoRole
): ProjectRepository {
  return {
    ...makeRepository(repo.owner, repo.name, role),
    htmlUrl: safeHref(repo.htmlUrl) || makeRepository(repo.owner, repo.name).htmlUrl,
    installationId: installation.installationId,
    githubRepositoryId: repo.id,
  };
}

// The repo part a member's position works in (풀스택 -> 프론트 first, then 백엔드)
const ROLES_BY_POSITION: Partial<Record<ProjectPosition, RepoRole[]>> = {
  BACKEND: ['BACKEND'],
  FRONTEND: ['FRONTEND'],
  FULLSTACK: ['FRONTEND', 'BACKEND'],
  INFRA: ['BACKEND'],
};

/** The repo for a member's part of the project: that part's repo, else the common one, else the first. */
export function repoForPosition(project: Project, position?: ProjectPosition): ProjectRepository | undefined {
  const repos = project.repositories || [];
  for (const role of (position && ROLES_BY_POSITION[position]) || []) {
    const hit = repos.find((r) => r.role === role);
    if (hit) return hit;
  }
  return repos.find((r) => r.role === 'COMMON') || repos[0];
}

/** Only http(s) links may be rendered as href (stored data could hold javascript: or other schemes). */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** The GitHub App install link from the backend must point at github.com before we send anyone there. */
export function isGitHubInstallUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com' && u.pathname.startsWith('/apps/');
  } catch {
    return false;
  }
}
