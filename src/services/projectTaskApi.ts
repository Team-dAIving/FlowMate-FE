import { Project, ProjectPosition, ProjectType, Task, TaskComment, TaskPriority, TaskStatus, User } from '../types';
import { http } from './http';
import { normalizeSkills } from '../utils/positions';

// Backend (FlowMate-BE, dev branch) endpoints for projects and tasks:
//   GET    /api/projects                -> my projects
//   GET    /api/teams/{teamId}          -> team detail incl. its tasks (the only task list endpoint)
//   GET    /api/tasks/{taskId}          -> task detail incl. comments and GitHub info
//   POST   /api/tasks/{taskId}/comments -> add a comment
//   DELETE /api/tasks/{taskId}          -> delete a task
// There are no create/update endpoints for projects or tasks yet (see services/features.ts).

// ---- DTOs (exactly as the backend records) ----
interface ProjectMemberSummaryDto {
  userId: number;
  nickname: string | null;
  avatarUrl: string | null;
  role: string | null; // "Leader" for the project leader
}
interface ProjectListItemDto {
  id: number;
  type: string | null;
  name: string | null;
  description: string | null;
  status: string | null;
  teamId: number;
  teamName: string | null;
  teamThemeColor: string | null;
  leaderName: string | null;
  techStack: Record<string, unknown> | null;
  members: ProjectMemberSummaryDto[] | null;
  totalTaskCount: number;
  completedTaskCount: number;
  progressPercent: number;
}
interface TeamTaskDto {
  id: number;
  projectId: number;
  projectName: string | null;
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
  tasks: TeamTaskDto[] | null;
}
interface TaskAssigneeDto {
  projectMemberId: number;
  userId: number;
  nickname: string | null;
  avatarUrl: string | null;
  role: string | null;
}
interface TaskGithubDto {
  githubRepositoryId: number | null;
  ownerLogin: string | null;
  repositoryName: string | null;
  repositoryUrl: string | null;
  issueNumber: number | null;
  issueUrl: string | null;
  syncStatus: string | null;
}
interface TaskCommentDto {
  id: number;
  authorUserId: number;
  authorNickname: string | null;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
  mine: boolean;
}
interface TaskDetailDto {
  id: number;
  projectId: number;
  projectName: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  planningStatus: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedTime: number | null;
  actualTime: number | null;
  completedAt: string | null;
  assignee: TaskAssigneeDto | null;
  github: TaskGithubDto | null;
  comments: TaskCommentDto[] | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ---- mappers ----
const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const TYPES: ProjectType[] = ['WEB', 'APP', 'AI', 'EMBEDDED', 'OTHER'];
const POSITION_BY_ROLE: Record<string, ProjectPosition> = {
  BACKEND: 'BACKEND',
  BE: 'BACKEND',
  FRONTEND: 'FRONTEND',
  FE: 'FRONTEND',
  DESIGN: 'DESIGN',
  DESIGNER: 'DESIGN',
  PM: 'PM',
};

const pick = <T extends string>(value: string | null | undefined, allowed: T[], fallback: T): T => {
  const v = (value || '').trim().toUpperCase() as T;
  return allowed.includes(v) ? v : fallback;
};
const isLeaderRole = (role: string | null) => (role || '').trim().toLowerCase() === 'leader';

const toUser = (id: number, nickname: string | null, avatarUrl: string | null): User => ({
  id: String(id),
  name: nickname || '이름 없음',
  avatarUrl: avatarUrl || undefined,
  email: '',
  role: 'MEMBER',
});

/** tech_stack is free-form JSON; collect every string in it (e.g. {"frontend":["React"],"backend":"Spring"}). */
function flattenTechStack(value: unknown, depth = 0): string[] {
  if (value == null || depth > 4) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((v) => flattenTechStack(v, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      v === true ? [k] : flattenTechStack(v, depth + 1)
    );
  }
  return [];
}

export function toProject(dto: ProjectListItemDto): Project {
  const members = (dto.members || []).map((m) => ({
    user: toUser(m.userId, m.nickname, m.avatarUrl),
    // permission: the leader owns the project
    role: isLeaderRole(m.role) ? ('OWNER' as const) : ('MEMBER' as const),
    position: POSITION_BY_ROLE[(m.role || '').trim().toUpperCase()],
  }));
  const leader = (dto.members || []).find((m) => isLeaderRole(m.role));
  return {
    id: String(dto.id),
    workspaceId: '',
    name: dto.name || '이름 없는 프로젝트',
    description: dto.description || '',
    goal: '',
    startDate: '',
    endDate: '',
    projectType: pick(dto.type, TYPES, 'OTHER'),
    techStack: normalizeSkills(flattenTechStack(dto.techStack), 40),
    members,
    leaderId: leader ? String(leader.userId) : undefined,
    progress: Number.isFinite(dto.progressPercent) ? dto.progressPercent : 0,
    createdAt: '',
  };
}

export function toTaskSummary(dto: TeamTaskDto): Task {
  return {
    id: String(dto.id),
    projectId: String(dto.projectId),
    projectName: dto.projectName || undefined,
    title: dto.title || '(제목 없음)',
    description: '', // only in the detail response
    assignee: dto.assigneeUserId != null ? toUser(dto.assigneeUserId, dto.assigneeNickname, dto.assigneeAvatarUrl) : undefined,
    priority: pick(dto.priority, PRIORITIES, 'MEDIUM'),
    status: pick(dto.status, STATUSES, 'TODO'),
    dueDate: dto.dueDate || undefined,
    githubIssue:
      dto.githubIssueNumber != null
        ? { id: dto.githubIssueNumber, number: dto.githubIssueNumber, title: '', htmlUrl: '', state: 'open' }
        : undefined,
    comments: [],
    activities: [],
    createdAt: '',
    updatedAt: '',
  };
}

const toComment = (c: TaskCommentDto): TaskComment => ({
  id: String(c.id),
  user: toUser(c.authorUserId, c.authorNickname, c.authorAvatarUrl),
  content: c.content,
  createdAt: c.createdAt,
});

export function toTaskDetail(dto: TaskDetailDto): Task {
  const gh = dto.github;
  return {
    id: String(dto.id),
    projectId: String(dto.projectId),
    projectName: dto.projectName || undefined,
    title: dto.title || '(제목 없음)',
    description: dto.description || '',
    assignee: dto.assignee ? toUser(dto.assignee.userId, dto.assignee.nickname, dto.assignee.avatarUrl) : undefined,
    priority: pick(dto.priority, PRIORITIES, 'MEDIUM'),
    status: pick(dto.status, STATUSES, 'TODO'),
    startDate: dto.startDate || undefined,
    dueDate: dto.dueDate || undefined,
    estimatedHours: dto.estimatedTime ?? undefined,
    actualHours: dto.actualTime ?? undefined,
    githubIssue:
      gh && gh.issueNumber != null
        ? {
            id: gh.issueNumber,
            number: gh.issueNumber,
            title: gh.repositoryName ? `${gh.ownerLogin ?? ''}/${gh.repositoryName}#${gh.issueNumber}` : `#${gh.issueNumber}`,
            htmlUrl: gh.issueUrl || '',
            state: 'open',
          }
        : undefined,
    comments: (dto.comments || []).map(toComment),
    activities: [],
    createdAt: dto.createdAt || '',
    updatedAt: dto.updatedAt || '',
  };
}

export const projectTaskApi = {
  getProjects: async (): Promise<Project[]> => {
    const res = await http<{ projects?: ProjectListItemDto[] }>('/api/projects');
    return (res?.projects || []).map(toProject);
  },

  /** All tasks of all my teams (the backend lists tasks per team only). */
  getTasks: async (teamIds: string[], projectId?: string): Promise<Task[]> => {
    // One team failing (e.g. you were just removed: 404) must not empty the whole list
    const results = await Promise.allSettled(
      teamIds.map((id) => http<TeamDetailDto>(`/api/teams/${encodeURIComponent(id)}`))
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0 && failed.length === results.length) throw (failed[0] as PromiseRejectedResult).reason;
    failed.forEach((r) => console.warn('Could not load tasks of a team:', (r as PromiseRejectedResult).reason));
    const seen = new Set<string>();
    const tasks: Task[] = [];
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const t of r.value?.tasks || []) {
        const task = toTaskSummary(t);
        if (seen.has(task.id) || (projectId && task.projectId !== projectId)) continue;
        seen.add(task.id);
        tasks.push(task);
      }
    }
    return tasks;
  },

  getTaskDetail: async (taskId: string): Promise<Task> =>
    toTaskDetail(await http<TaskDetailDto>(`/api/tasks/${encodeURIComponent(taskId)}`)),

  addComment: async (taskId: string, content: string): Promise<TaskComment> =>
    toComment(
      await http<TaskCommentDto>(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: 'POST',
        json: { content: content.trim() },
      })
    ),

  deleteTask: async (taskId: string): Promise<void> => {
    await http<unknown>(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
  },
};
