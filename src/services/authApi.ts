import { User } from '../types';
import { http } from './http';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/** GET this URL in the system browser to start the GitHub OAuth flow. */
export const GITHUB_LOGIN_URL = `${BASE_URL}/oauth2/authorization/github`;

/** The backend redirects here after OAuth: flowmate://oauth/callback?accessToken=...&onboardingRequired=true|false */
export const OAUTH_CALLBACK_PROTOCOL = 'flowmate:';

export const NICKNAME_LIMITS = { MAX: 30 } as const;

// ---- Backend DTO ----
interface AuthUserDto {
  userId: number;
  userCode: string;
  nickname: string | null;
  email: string | null;
  githubLogin: string;
  avatarUrl: string | null;
  onboardingRequired: boolean;
}

export interface AuthUser {
  user: User;
  onboardingRequired: boolean;
}

const toAuthUser = (dto: AuthUserDto): AuthUser => ({
  onboardingRequired: dto.onboardingRequired,
  user: {
    id: String(dto.userId),
    name: dto.nickname || dto.githubLogin,
    email: dto.email || '',
    avatarUrl: dto.avatarUrl || undefined,
    role: 'MEMBER',
    userCode: dto.userCode,
  },
});

export interface OAuthCallbackResult {
  accessToken?: string;
  onboardingRequired: boolean;
  error?: string;
}

/** Parses flowmate://oauth/callback?... Returns null for any other URL. */
export function parseOAuthCallback(rawUrl: string): OAuthCallbackResult | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== OAUTH_CALLBACK_PROTOCOL) return null;
    return {
      accessToken: url.searchParams.get('accessToken') || undefined,
      onboardingRequired: url.searchParams.get('onboardingRequired') === 'true',
      error: url.searchParams.get('error') || undefined,
    };
  } catch {
    return null;
  }
}

export const authApi = {
  // GET /api/auth/me
  getMe: async (): Promise<AuthUser> => toAuthUser(await http<AuthUserDto>('/api/auth/me')),

  // PATCH /api/auth/me/nickname
  setNickname: async (nickname: string): Promise<AuthUser> =>
    toAuthUser(
      await http<AuthUserDto>('/api/auth/me/nickname', {
        method: 'PATCH',
        json: { nickname: nickname.trim() },
      })
    ),

  // POST /api/auth/logout (204)
  logout: async (): Promise<void> => {
    await http<unknown>('/api/auth/logout', { method: 'POST' });
  },
};
