import {
  CreateTeamInput,
  PublicUserProfile,
  Task,
  TaskPriority,
  TaskStatus,
  Team,
  TeamDetail,
  TeamMember,
  USER_CODE_PATTERN,
} from '../types';
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

interface TeamDetailProjectDto {
  id: number;
  name: string;
  description: string | null;
  subject: string | null;
  totalTaskCount: number;
  completedTaskCount: number;
  progressPercent: number;
}

interface TeamDetailMemberDto extends TeamMemberDto {
  totalAssignedTaskCount: number;
  inProgressAssignedTaskCount: number;
}

interface TeamDetailTaskDto {
  id: number;
  projectId: number;
  projectName: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  assigneeUserId: number | null;
  assigneeNickname: string | null;
  assigneeAvatarUrl: string | null;
  dueDate: string | null;
  githubIssueNumber: number | null;
}

interface TeamDetailDto {
  id: number;
  name: string;
  description: string | null;
  themeColor: string;
  projectCount: number;
  memberCount: number;
  taskCount: number;
  inProgressTaskCount: number;
  completedTaskCount: number;
  projects: TeamDetailProjectDto[];
  members: TeamDetailMemberDto[];
  tasks: TeamDetailTaskDto[];
}

// ---- Mappers: backend DTO → FE model ----
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_TEAM_COLOR = '#4F46E5';
const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const pick = <T extends string>(value: string | null, allowed: T[], fallback: T): T => {
  const normalized = (value || '').trim().toUpperCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
};

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

const toDetailTask = (dto: TeamDetailTaskDto): Task => ({
  id: String(dto.id),
  projectId: String(dto.projectId),
  projectName: dto.projectName,
  title: dto.title || '(제목 없음)',
  description: '',
  assignee:
    dto.assigneeUserId == null
      ? undefined
      : {
          id: String(dto.assigneeUserId),
          name: dto.assigneeNickname || '이름 없음',
          email: '',
          avatarUrl: dto.assigneeAvatarUrl || undefined,
          role: 'MEMBER',
        },
  priority: pick(dto.priority, TASK_PRIORITIES, 'MEDIUM'),
  status: pick(dto.status, TASK_STATUSES, 'TODO'),
  dueDate: dto.dueDate || undefined,
  githubIssue:
    dto.githubIssueNumber == null
      ? undefined
      : {
          id: dto.githubIssueNumber,
          number: dto.githubIssueNumber,
          title: `#${dto.githubIssueNumber}`,
          htmlUrl: '',
          state: 'open',
        },
  comments: [],
  activities: [],
  createdAt: '',
  updatedAt: '',
});

export const toTeamDetail = (dto: TeamDetailDto): TeamDetail => {
  const members = (dto.members || []).map((member) => ({
    ...toMember(member),
    totalAssignedTaskCount: member.totalAssignedTaskCount ?? 0,
    inProgressAssignedTaskCount: member.inProgressAssignedTaskCount ?? 0,
  }));
  const projects = (dto.projects || []).map((project) => ({
    id: String(project.id),
    name: project.name || '이름 없는 프로젝트',
    description: project.description || undefined,
    subject: project.subject || undefined,
    totalTaskCount: project.totalTaskCount ?? 0,
    completedTaskCount: project.completedTaskCount ?? 0,
    progressPercent: Math.min(100, Math.max(0, project.progressPercent ?? 0)),
  }));
  return {
    id: String(dto.id),
    name: dto.name || '이름 없는 팀',
    description: dto.description || '',
    color: dto.themeColor && HEX_COLOR.test(dto.themeColor) ? dto.themeColor : DEFAULT_TEAM_COLOR,
    projectCount: dto.projectCount ?? projects.length,
    memberCount: dto.memberCount ?? members.length,
    taskCount: dto.taskCount ?? 0,
    inProgressTaskCount: dto.inProgressTaskCount ?? 0,
    completedTaskCount: dto.completedTaskCount ?? 0,
    projectIds: projects.map((project) => project.id),
    memberIds: members.map((member) => member.id),
    projects,
    members,
    tasks: (dto.tasks || []).map(toDetailTask),
  };
};

// ---- Endpoints ----
export const teamApi = {
  // GET /api/teams
  getTeams: async (): Promise<Team[]> => {
    const res = await http<TeamListResponse>('/api/teams');
    return (res?.teams || []).map(toTeam);
  },

  // GET /api/teams/{teamId}
  getTeamDetail: async (teamId: string): Promise<TeamDetail> =>
    toTeamDetail(await http<TeamDetailDto>(`/api/teams/${encodeURIComponent(teamId)}`)),

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
