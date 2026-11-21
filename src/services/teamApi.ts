import { CreateTeamInput, PublicUserProfile, Team, TeamMember, USER_CODE_PATTERN } from '../types';
import { ApiError, http } from './http';

// ---- Backend DTOs (shape exactly as the backend spec) ----
interface TeamMemberDto {
  userId: number;
  nickname: string | null;
  avatarUrl: string | null;
}

interface TeamProjectDto {
  id: number;
  name: string | null;
  subject: string | null;
}

interface TeamDto {
  id: number;
  name: string | null;
  description: string | null;
  themeColor: string | null;
  memberCount: number;
  projects?: TeamProjectDto[];
  members: TeamMemberDto[];
  inProgressTaskCount?: number;
}

interface TeamListResponse {
  teams: TeamDto[];
}

interface UserByCodeResponse {
  userId: number;
  userCode: string;
  nickname: string | null;
  avatarUrl: string | null;
}

// ---- Mappers: backend DTO → FE model ----
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_TEAM_COLOR = '#4F46E5';

const toMember = (m: TeamMemberDto): TeamMember => ({
  id: String(m.userId),
  name: m.nickname || '이름 없음',
  avatarUrl: m.avatarUrl || undefined,
});

export function toTeam(dto: TeamDto): Team {
  const members = (dto.members || []).map(toMember);
  const projects = (dto.projects || []).map((p) => ({
    id: String(p.id),
    name: p.name || '이름 없는 프로젝트',
    subject: p.subject || undefined, // project goal/summary, not an identifier
  }));
  return {
    id: String(dto.id),
    name: dto.name || '이름 없는 팀',
    description: dto.description || '',
    color: dto.themeColor && HEX_COLOR.test(dto.themeColor) ? dto.themeColor : DEFAULT_TEAM_COLOR,
    members,
    memberIds: members.map((m) => m.id),
    memberCount: dto.memberCount ?? members.length,
    projects,
    projectIds: projects.map((p) => p.id),
    inProgressTaskCount: dto.inProgressTaskCount,
  };
}

// ---- Endpoints ----
export const teamApi = {
  // GET /api/teams
  getTeams: async (): Promise<Team[]> => {
    const res = await http<TeamListResponse>('/api/teams');
    return (res?.teams || []).map(toTeam);
  },

  // POST /api/teams
  createTeam: async (input: CreateTeamInput): Promise<Team> => {
    // Backend ids are Long. Anything non-numeric (e.g. a mock user id) can't be sent.
    // The server adds the logged-in user itself, so memberUserIds holds only the invitees.
    // A team needs at least 2 people (creator + 1 invitee).
    const memberUserIds = Array.from(new Set(input.memberIds))
      .map(Number)
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    if (memberUserIds.length === 0) {
      throw new ApiError(400, '팀은 본인을 포함해 2명 이상이어야 합니다. 팀원을 1명 이상 초대해주세요.');
    }
    const dto = await http<TeamDto>('/api/teams', {
      method: 'POST',
      json: {
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        themeColor: input.color,
        memberUserIds,
      },
    });
    return toTeam(dto);
  },

  // GET /api/users/code/{userCode} — 404 means "no such user", not an error
  findUserByCode: async (code: string): Promise<PublicUserProfile | null> => {
    const normalized = code.trim().toUpperCase();
    if (!USER_CODE_PATTERN.test(normalized)) return null;
    try {
      const res = await http<UserByCodeResponse>(`/api/users/code/${encodeURIComponent(normalized)}`);
      return {
        id: String(res.userId),
        name: res.nickname || res.userCode,
        avatarUrl: res.avatarUrl || undefined,
        userCode: res.userCode,
      };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
};
