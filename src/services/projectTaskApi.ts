import {
  CreateProjectInput,
  IssueDraft,
  Meeting,
  MeetingStatus,
  ProjectDashboard,
  ProjectMember,
  Project,
  ProjectRepository,
  ProjectType,
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  User,
} from '../types';
import { http } from './http';
import { normalizeSkills, partToPosition, positionToPart } from '../utils/positions';
import { makeRepository, safeHref, toRepoRole } from '../utils/github';

// Backend (FlowMate-BE, dev branch) endpoints for projects and tasks:
//   GET    /api/projects                -> my projects
//   POST   /api/projects                -> create (team, members with part/stack, GitHub App repos)
//   GET    /api/projects/{id}           -> detail (dates, leader, counts)
//   POST   /api/projects/issue-drafts   -> AI task drafts from the project info (nothing is saved)
//   GET    /api/projects/{id}/tasks     -> the project's tasks
//   POST   /api/projects/{id}/tasks      -> also used for one task (single item), optional GitHub issue in a chosen repo
//   GET    /api/projects/{id}/repositories -> repos connected to the project
//   GET    /api/tasks                   -> all my tasks, grouped by project
//   GET    /api/projects/{id}/members   -> members with e-mail, parts, stack
//   GET    /api/projects/{id}/meetings  -> the project's meetings (summary, status)
//   GET    /api/tasks/{taskId}          -> task detail incl. comments and GitHub info
//   POST   /api/tasks/{taskId}/comments -> add a comment
//   DELETE /api/tasks/{taskId}          -> delete a task
// Not there yet: editing a project, creating/updating tasks (incl. registering AI drafts) and
// creating GitHub issues (see services/features.ts).

// ---- DTOs (exactly as the backend records) ----
interface ProjectMemberSummaryDto {
  userId: number;
  nickname: string | null;
  avatarUrl: string | null;
  role: string | null; // "Leader" for the project leader
  parts: string[] | null; // backend part values: backend, frontend, fullstack, design, pm, infra, others
  techStack: string[] | null;
}
interface ProjectListItemDto {
  id: number;
  type: string | null;
  name: string | null;
  description: string | null;
  goal: string | null;
  status: string | null;
  teamId: number;
  teamName: string | null;
  teamThemeColor: string | null;
  leaderName: string | null;
  techStack: unknown; // List<String> now; older servers sent free-form JSON
  members: ProjectMemberSummaryDto[] | null;
  totalTaskCount: number;
  completedTaskCount: number;
  progressPercent: number;
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
const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const TYPES: ProjectType[] = ['WEB', 'APP', 'AI', 'EMBEDDED', 'OTHER'];

const pick = <T extends string>(value: string | null | undefined, allowed: T[], fallback: T): T => {
  const v = (value || '').trim().toUpperCase() as T;
  return allowed.includes(v) ? v : fallback;
};
// The server stores task times in minutes (estimatedHours * 60 on registration)
const minutesToHours = (m: number | null | undefined) =>
  typeof m === 'number' && Number.isFinite(m) ? Math.round((m / 60) * 10) / 10 : undefined;

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
    position: (m.parts || []).map(partToPosition).find(Boolean),
    skills: normalizeSkills((m.techStack || []).filter((s): s is string => typeof s === 'string')),
  }));
  const leader = (dto.members || []).find((m) => isLeaderRole(m.role));
  return {
    id: String(dto.id),
    workspaceId: '',
    teamId: dto.teamId != null ? String(dto.teamId) : undefined,
    name: dto.name || '이름 없는 프로젝트',
    description: dto.description || '',
    goal: dto.goal || '',
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

const toComment = (c: TaskCommentDto): TaskComment => ({
  id: String(c.id),
  user: toUser(c.authorUserId, c.authorNickname, c.authorAvatarUrl),
  content: c.content,
  createdAt: c.createdAt,
});

export function toProjectTask(dto: ProjectTaskDto, projectId: string, projectName?: string): Task {
  const gh = dto.github;
  const repoUrl = safeHref(gh?.htmlUrl || undefined);
  return {
    id: String(dto.id),
    projectId,
    projectName,
    title: dto.title || '(제목 없음)',
    description: dto.description || '',
    assignee: dto.assignee ? toUser(dto.assignee.userId, dto.assignee.nickname, dto.assignee.avatarUrl) : undefined,
    priority: pick(dto.priority, PRIORITIES, 'MEDIUM'),
    status: pick(dto.status, STATUSES, 'TODO'),
    startDate: dto.startDate || undefined,
    dueDate: dto.dueDate || undefined,
    estimatedHours: minutesToHours(dto.estimatedTime),
    actualHours: minutesToHours(dto.actualTime),
    completedAt: dto.completedAt || undefined,
    commentCount: dto.commentCount ?? 0,
    githubIssue:
      gh && gh.issueNumber != null
        ? {
            id: gh.issueNumber,
            number: gh.issueNumber,
            title: gh.repositoryName ? `${gh.repositoryName}#${gh.issueNumber}` : `#${gh.issueNumber}`,
            // the list only has the repository URL; the issue URL follows GitHub's pattern
            htmlUrl: repoUrl ? `${repoUrl.replace(/\/+$/, '')}/issues/${gh.issueNumber}` : '',
            state: pick(dto.status, STATUSES, 'TODO') === 'DONE' ? 'closed' : 'open',
          }
        : undefined,
    comments: [],
    activities: [],
    createdAt: dto.createdAt || '',
    updatedAt: dto.updatedAt || '',
  };
}

const toProjectMember = (m: ProjectMemberDto): ProjectMember => ({
  user: { ...toUser(m.userId, m.nickname, m.avatarUrl), email: m.email || '' },
  role: m.leader ? 'OWNER' : 'MEMBER',
  position: (m.parts || []).map(partToPosition).find(Boolean),
  skills: normalizeSkills((m.techStack || []).filter((s): s is string => typeof s === 'string')),
});

// processingStatus is free text on the backend; map what the UI can show
function toMeetingStatus(value: string | null): MeetingStatus {
  const v = (value || '').trim().toUpperCase();
  if (['COMPLETED', 'ANALYZED', 'DONE', 'SUCCESS'].includes(v)) return 'ANALYZED';
  if (v === 'FAILED' || v === 'ERROR') return 'FAILED';
  if (v === 'RECORDING') return 'RECORDING';
  if (['RECORDED', 'UPLOADED', 'PENDING'].includes(v)) return 'RECORDED';
  return 'TRANSCRIBING';
}

const toMeeting = (m: ProjectMeetingDto, projectId: string, projectName?: string): Meeting => ({
  id: String(m.id),
  projectId,
  projectName,
  title: m.title || '(제목 없는 회의)',
  meetingDate: m.heldAt || '',
  participants: [],
  audioDurationSeconds: m.durationSeconds ?? undefined,
  status: toMeetingStatus(m.processingStatus),
  summary: m.summary || undefined,
  approvedActionItemCount: m.approvedActionItemCount ?? 0,
  createdAt: m.heldAt || '',
});

function toDashboard(d: ProjectDashboardDto): ProjectDashboard {
  const statusCounts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, CANCELLED: 0 };
  for (const [k, v] of Object.entries(d.taskStatusCounts || {})) {
    const s = pick(k, STATUSES, 'TODO');
    if (s === k.toUpperCase() && Number.isFinite(v)) statusCounts[s] += v;
  }
  return {
    startDate: d.startDate || undefined,
    endDate: d.endDate || undefined,
    progressPercent: d.progress?.percent ?? 0,
    totalTaskCount: d.progress?.totalTaskCount ?? 0,
    completedTaskCount: d.progress?.completedTaskCount ?? 0,
    statusCounts,
    workload: (d.workload || []).map((w) => ({
      userId: String(w.userId),
      name: w.nickname || '이름 없음',
      avatarUrl: w.avatarUrl || undefined,
      active: w.activeTaskCount ?? 0,
      done: w.completedTaskCount ?? 0,
    })),
    velocity: (d.velocity || []).map((v) => ({ date: v.date, completed: v.completedTaskCount ?? 0 })),
    counts: {
      tasks: d.counts?.taskCount ?? 0,
      meetings: d.counts?.meetingCount ?? 0,
      members: d.counts?.memberCount ?? 0,
    },
  };
}

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
    estimatedHours: minutesToHours(dto.estimatedTime),
    actualHours: minutesToHours(dto.actualTime),
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

// GET /api/projects/{id}/tasks items (also recentTasks of the project detail)
interface ProjectTaskDto {
  id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedTime: number | null;
  actualTime: number | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  assignee: { userId: number; nickname: string | null; avatarUrl: string | null } | null;
  github: {
    repositoryName: string | null;
    htmlUrl: string | null; // the repository URL
    issueNumber: number | null;
  } | null;
  commentCount: number;
}
interface ProjectMemberDto {
  projectMemberId: number;
  userId: number;
  nickname: string | null;
  email: string | null;
  avatarUrl: string | null;
  parts: string[] | null;
  techStack: string[] | null;
  leader: boolean;
  accessRole: string | null; // OWNER for the leader, MEMBER otherwise
}
interface ProjectMeetingDto {
  id: number;
  title: string | null;
  summary: string | null;
  heldAt: string | null;
  durationSeconds: number | null;
  processingStatus: string | null;
  approvedActionItemCount: number;
}
interface ProjectDashboardDto {
  startDate: string | null;
  endDate: string | null;
  counts: { taskCount: number; meetingCount: number; memberCount: number } | null;
  progress: { totalTaskCount: number; completedTaskCount: number; percent: number } | null;
  taskStatusCounts: Record<string, number> | null;
  workload:
    | { userId: number; nickname: string | null; avatarUrl: string | null; activeTaskCount: number; completedTaskCount: number }[]
    | null;
  velocity: { date: string; completedTaskCount: number }[] | null;
}

interface ProjectRepositoryDto {
  githubRepositoryId: number;
  owner?: string | null;
  name?: string | null;
  // The project detail API names these ownerLogin/repositoryName/repositoryRole (same table); accept both
  ownerLogin?: string | null;
  repositoryName?: string | null;
  htmlUrl: string | null;
  role?: string | null; // COMMON | BACKEND | FRONTEND | AI
  repositoryRole?: string | null;
}
interface CreateTaskResponseDto {
  taskId: number;
  title: string | null;
  githubIssueRequested: boolean;
  githubSyncStatus: string | null; // SYNCED | FAILED | NOT_LINKED
  githubRepositoryId: number | null;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  githubError: string | null;
}
export interface ManualTaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate: string;
  estimatedHours?: number;
  createGithubIssue: boolean;
  githubRepositoryId?: string;
}
export interface ManualTaskResult {
  taskId: string;
  issueUrl?: string;
  issueFailed: boolean;
  issueError?: string;
}

interface ConnectedRepositoryDto {
  githubRepositoryId: number;
  installationId: number;
  owner: string | null;
  name: string | null;
  htmlUrl: string | null;
  role: string | null;
}
interface CreateProjectResponseDto {
  id: number;
  importedGithubIssueCount: number;
  githubIssueImportStatus: string | null; // NOT_REQUESTED | SUCCESS | FAILED
  repositories: ConnectedRepositoryDto[] | null;
}
interface ProjectDetailDto {
  id: number;
  startDate: string | null;
  endDate: string | null;
  team: { id: number } | null;
}
interface TeamDetailProjectDto {
  id: number;
  designText: string | null;
}
interface IssueDraftDto {
  title: string;
  description: string | null;
  priority: string | null;
  assigneeId: number | null;
  startDate: string;
  dueDate: string;
  estimatedHours: number | null;
  labels: string[] | null;
}

export interface CreateProjectResult {
  id: string;
  importedIssueCount: number;
  issueImportFailed: boolean;
  repositories: ProjectRepository[];
}

const toConnectedRepo = (r: ConnectedRepositoryDto): ProjectRepository => ({
  id: `${r.owner}/${r.name}`.toLowerCase(),
  role: toRepoRole(r.role),
  owner: r.owner || '',
  name: r.name || '',
  fullName: `${r.owner}/${r.name}`,
  htmlUrl: safeHref(r.htmlUrl || undefined) || '',
  installationId: String(r.installationId),
  githubRepositoryId: String(r.githubRepositoryId),
});

const toId = (id: string) => {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`잘못된 ID입니다: ${id}`);
  return n;
};

// Project info shared by POST /api/projects and POST /api/projects/issue-drafts
const projectBody = (input: Omit<CreateProjectInput, 'repositories' | 'additionalTechStack'>) => ({
  name: input.name.trim(),
  description: input.description.trim(),
  goal: input.goal.trim(),
  designText: input.designText.trim(),
  type: input.projectType,
  startDate: input.startDate,
  endDate: input.endDate,
  ...(input.teamId ? { teamId: toId(input.teamId) } : {}),
  leaderUserId: toId(input.leaderId),
});

export interface IssueDraftRequest extends Omit<CreateProjectInput, 'repositories' | 'additionalTechStack'> {
  /** GitHub repo URL per member (their part's repo), helps the AI place work */
  repoUrlByUserId?: Record<string, string | undefined>;
}

let draftSeq = 0;
export const toIssueDraft = (d: IssueDraftDto): IssueDraft => ({
  key: `draft-${Date.now()}-${draftSeq++}`,
  title: d.title,
  description: d.description || '',
  priority: pick(d.priority, PRIORITIES, 'MEDIUM'),
  assigneeId: d.assigneeId != null ? String(d.assigneeId) : undefined,
  startDate: d.startDate,
  dueDate: d.dueDate,
  estimatedHours: d.estimatedHours ?? undefined,
  labels: (d.labels || []).filter((l): l is string => typeof l === 'string'),
  createGithubIssue: true,
});

export const projectTaskApi = {
  getProjects: async (): Promise<Project[]> => {
    const res = await http<{ projects?: ProjectListItemDto[] }>('/api/projects');
    return (res?.projects || []).map(toProject);
  },

  createProject: async (input: CreateProjectInput): Promise<CreateProjectResult> => {
    const res = await http<CreateProjectResponseDto>('/api/projects', {
      method: 'POST',
      // The server reads every connected repo's issues from GitHub before answering
      timeoutMs: 60000,
      json: {
        ...projectBody(input),
        members: input.members.map((m) => ({
          userId: toId(m.user.id),
          part: positionToPart(m.position),
          techStack: m.skills,
        })),
        additionalTechStack: input.additionalTechStack,
        repositories: input.repositories.map((r) => {
          if (!r.installationId || !r.githubRepositoryId) throw new Error(`${r.fullName}은(는) GitHub 앱에서 고른 레포가 아닙니다.`);
          return {
            installationId: toId(r.installationId),
            githubRepositoryId: toId(r.githubRepositoryId),
            role: r.role.toLowerCase(),
          };
        }),
      },
    });
    return {
      id: String(res.id),
      importedIssueCount: res.importedGithubIssueCount ?? 0,
      issueImportFailed: res.githubIssueImportStatus === 'FAILED',
      repositories: (res.repositories || []).map(toConnectedRepo),
    };
  },

  /**
   * POST /api/projects/{id}/tasks: registers confirmed drafts as tasks, then opens GitHub issues for
   * the marked ones. Without githubRepositoryId the server picks the repo of the assignee's part,
   * else the common repo. Tasks are saved even when a GitHub issue fails (reported per task).
   */
  registerIssueDrafts: async (
    projectId: string,
    drafts: IssueDraft[]
  ): Promise<{ created: number; issuesCreated: number; issuesFailed: number }> => {
    const res = await http<{ createdTaskCount: number; createdGithubIssueCount: number; failedGithubIssueCount: number }>(
      `/api/projects/${encodeURIComponent(projectId)}/tasks`,
      {
        method: 'POST',
        timeoutMs: 120000, // one GitHub call per issue
        json: {
          issues: drafts.map((d) => ({
            title: d.title.trim(),
            description: d.description.trim(),
            priority: d.priority,
            ...(d.assigneeId ? { assigneeId: toId(d.assigneeId) } : {}),
            startDate: d.startDate,
            dueDate: d.dueDate,
            ...(d.estimatedHours != null && d.estimatedHours > 0 ? { estimatedHours: d.estimatedHours } : {}),
            labels: [...new Set(d.labels.map((l) => l.trim().slice(0, 50)).filter(Boolean))].slice(0, 20),
            createGithubIssue: d.createGithubIssue,
            ...(d.createGithubIssue && d.githubRepositoryId ? { githubRepositoryId: toId(d.githubRepositoryId) } : {}),
          })),
        },
      }
    );
    return {
      created: res?.createdTaskCount ?? drafts.length,
      issuesCreated: res?.createdGithubIssueCount ?? 0,
      issuesFailed: res?.failedGithubIssueCount ?? 0,
    };
  },

  /** GET /api/projects/{id}/repositories: the repos connected to the project, with their role. */
  getProjectRepositories: async (projectId: string): Promise<ProjectRepository[]> => {
    const res = await http<{ repositories?: ProjectRepositoryDto[] } | ProjectRepositoryDto[]>(
      `/api/projects/${encodeURIComponent(projectId)}/repositories`
    );
    const list = Array.isArray(res) ? res : res?.repositories || [];
    const repos = list.flatMap((r) => {
      // owner/name may be missing: fall back to the GitHub URL (https://github.com/owner/name)
      const fromUrl = (r.htmlUrl || '').match(/github\.com\/([^/]+)\/([^/?#]+)/i);
      const owner = r.owner || r.ownerLogin || fromUrl?.[1];
      const name = r.name || r.repositoryName || fromUrl?.[2];
      if (!owner || !name) return [];
      return [
        {
          ...makeRepository(owner, name, toRepoRole(r.role || r.repositoryRole)),
          htmlUrl: safeHref(r.htmlUrl || undefined) || makeRepository(owner, name).htmlUrl,
          githubRepositoryId: String(r.githubRepositoryId),
        },
      ];
    });
    if (list.length > 0 && repos.length === 0) console.warn('[api] repositories response has no usable owner/name:', list);
    return repos;
  },

  /**
   * POST /api/projects/{id}/tasks with a single item: one task, optionally with a GitHub issue in the given repo.
   * The start date is today (Seoul), but never after the due date. The task is kept even if the issue fails.
   */
  createManualTask: async (projectId: string, input: ManualTaskInput): Promise<ManualTaskResult> => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()); // YYYY-MM-DD
    const res = await http<{ tasks?: CreateTaskResponseDto[] }>(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'POST',
      timeoutMs: 60000, // includes the GitHub call
      json: {
        issues: [
          {
            title: input.title.trim(),
            description: input.description.trim(),
            priority: input.priority,
            ...(input.assigneeId ? { assigneeId: toId(input.assigneeId) } : {}),
            startDate: input.dueDate < today ? input.dueDate : today,
            dueDate: input.dueDate,
            ...(input.estimatedHours != null && input.estimatedHours > 0 ? { estimatedHours: input.estimatedHours } : {}),
            labels: [],
            createGithubIssue: input.createGithubIssue,
            ...(input.createGithubIssue && input.githubRepositoryId ? { githubRepositoryId: toId(input.githubRepositoryId) } : {}),
          },
        ],
      },
    });
    const created = res?.tasks?.[0];
    if (!created) throw new Error('서버가 등록된 업무 정보를 돌려주지 않았습니다.');
    return {
      taskId: String(created.taskId),
      issueUrl: safeHref(created.githubIssueUrl || undefined),
      issueFailed: created.githubIssueRequested && created.githubSyncStatus === 'FAILED',
      issueError: created.githubError || undefined,
    };
  },  /** GET /api/tasks: every task of every project I'm in, in one request. */
  getMyTasks: async (): Promise<Task[]> => {
    const res = await http<{ projects?: { projectId: number; projectName: string | null; tasks?: ProjectTaskDto[] }[] }>(
      '/api/tasks'
    );
    return (res?.projects || []).flatMap((p) =>
      (p.tasks || []).map((t) => toProjectTask(t, String(p.projectId), p.projectName || undefined))
    );
  },

  /** GET /api/projects/{id}: dates, progress, status counts, workload, 7-day velocity. */
  getProjectDashboard: async (projectId: string): Promise<ProjectDashboard> =>
    toDashboard(await http<ProjectDashboardDto>(`/api/projects/${encodeURIComponent(projectId)}`)),

  getProjectTasks: async (projectId: string, projectName?: string): Promise<Task[]> => {
    const res = await http<{ tasks?: ProjectTaskDto[] }>(`/api/projects/${encodeURIComponent(projectId)}/tasks`);
    return (res?.tasks || []).map((t) => toProjectTask(t, projectId, projectName));
  },

  getProjectMembers: async (projectId: string): Promise<ProjectMember[]> => {
    const res = await http<{ members?: ProjectMemberDto[] }>(`/api/projects/${encodeURIComponent(projectId)}/members`);
    return (res?.members || []).map(toProjectMember);
  },

  getProjectMeetings: async (projectId: string, projectName?: string): Promise<Meeting[]> => {
    const res = await http<{ meetings?: ProjectMeetingDto[] }>(`/api/projects/${encodeURIComponent(projectId)}/meetings`);
    return (res?.meetings || []).map((m) => toMeeting(m, projectId, projectName));
  },

  /** Start/end dates (not in the project list) via GET /api/projects/{id}. */
  getProjectDates: async (projectId: string): Promise<{ startDate: string; endDate: string; teamId?: string }> => {
    const d = await http<ProjectDetailDto>(`/api/projects/${encodeURIComponent(projectId)}`);
    return { startDate: d.startDate || '', endDate: d.endDate || '', teamId: d.team ? String(d.team.id) : undefined };
  },

  /** The design document only comes with the team detail (GET /api/teams/{id} -> projects[].designText). */
  getDesignText: async (teamId: string, projectId: string): Promise<string> => {
    const team = await http<{ projects?: TeamDetailProjectDto[] }>(`/api/teams/${encodeURIComponent(teamId)}`);
    return (team?.projects || []).find((p) => String(p.id) === projectId)?.designText || '';
  },

  generateIssueDrafts: async (input: IssueDraftRequest): Promise<IssueDraft[]> => {
    const res = await http<{ issues?: IssueDraftDto[] }>('/api/projects/issue-drafts', {
      method: 'POST',
      timeoutMs: 120000, // the AI server can take a while
      json: {
        ...projectBody(input),
        members: input.members.map((m) => {
          const url = input.repoUrlByUserId?.[m.user.id];
          return {
            userId: toId(m.user.id),
            part: positionToPart(m.position),
            techStack: m.skills.join(', '),
            ...(url ? { githubRepositoryUrl: url.slice(0, 500) } : {}),
          };
        }),
      },
    });
    return (res?.issues || []).map(toIssueDraft);
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
