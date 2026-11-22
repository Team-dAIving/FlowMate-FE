import { User } from '../types';
import { http } from './http';

// Desktop: the GitHub OAuth flow and the JWT are handled by the Electron main process (electron/auth.cjs).
// Web: services/webAuth.ts. Either way these calls carry "Authorization: Bearer" (see http.ts).

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
    githubLogin: dto.githubLogin,
  },
});

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

  // POST /api/auth/token { code, client } -> { accessToken, onboardingRequired }
  // Only for the one-time code flow (proposed to the backend); the desktop app exchanges in the main process.
  exchangeCode: async (code: string, client: 'web' | 'desktop'): Promise<{ accessToken: string; onboardingRequired: boolean }> => {
    const res = await http<{ accessToken?: unknown; onboardingRequired?: unknown }>('/api/auth/token', {
      method: 'POST',
      json: { code, client },
    });
    if (typeof res?.accessToken !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(res.accessToken)) {
      throw new Error('로그인 응답이 올바르지 않습니다.');
    }
    return { accessToken: res.accessToken, onboardingRequired: res.onboardingRequired === true };
  },

  // POST /api/auth/logout (204)
  logout: async (): Promise<void> => {
    await http<unknown>('/api/auth/logout', { method: 'POST' });
  },
};
