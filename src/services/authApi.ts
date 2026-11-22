import { User } from '../types';
import { http } from './http';

// The GitHub OAuth flow and the JWT are handled by the Electron main process (electron/auth.cjs).
// These calls are authenticated by the header that process attaches.

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
