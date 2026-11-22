import { Project, ProjectPosition, ProjectRepository } from '../types';

// GitHub naming rules: owner (user/org) 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
// Repository: 1-100 of letters, digits, '.', '-', '_' (but not "." or "..")
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export const REPOS_MAX = 20;

export const isValidGitHubOwner = (s: string) => OWNER_RE.test(s);
const isValidRepoName = (s: string) => REPO_RE.test(s) && s !== '.' && s !== '..';

export type ParsedRepo = { ok: true; owner: string; name: string } | { ok: false; error: string };

/**
 * Accepts "repo" (placed under `org`), "owner/repo", or a github.com URL (with or without .git).
 */
export function parseRepoInput(raw: string, org?: string): ParsedRepo {
  let s = raw.trim();
  if (!s) return { ok: false, error: '레포지토리 이름을 입력해주세요.' };

  const url = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)\/?(?:[?#].*)?$/i);
  if (url) s = `${url[1]}/${url[2]}`;
  s = s.replace(/\.git$/i, '');

  const parts = s.split('/');
  let owner: string;
  let name: string;
  if (parts.length === 1) {
    if (!org) return { ok: false, error: 'Organization을 고르거나 "owner/레포" 형식으로 입력해주세요.' };
    owner = org;
    name = parts[0];
  } else if (parts.length === 2) {
    [owner, name] = parts;
  } else {
    return { ok: false, error: '"레포" 또는 "owner/레포" 형식으로 입력해주세요.' };
  }
  if (!isValidGitHubOwner(owner)) return { ok: false, error: `"${owner}"은(는) 올바른 GitHub 계정/Organization 이름이 아닙니다.` };
  if (!isValidRepoName(name)) return { ok: false, error: `"${name}"은(는) 올바른 레포지토리 이름이 아닙니다.` };
  return { ok: true, owner, name };
}

export function makeRepository(owner: string, name: string, position?: ProjectPosition): ProjectRepository {
  return {
    id: `${owner}/${name}`.toLowerCase(),
    position,
    owner,
    name,
    fullName: `${owner}/${name}`,
    htmlUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
  };
}

/** The repo for a given part of the project: that position's repo, else a shared one, else the first. */
export function repoForPosition(project: Project, position?: ProjectPosition): ProjectRepository | undefined {
  const repos = project.repositories || [];
  return (
    (position && repos.find((r) => r.position === position)) || repos.find((r) => !r.position) || repos[0]
  );
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
