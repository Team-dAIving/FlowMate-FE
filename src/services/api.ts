import {
  User,
  Workspace,
  Project,
  Task,
  TaskComment,
  Meeting,
  Notification,
  ActionItem,
  Team,
  PublicUserProfile,
  USER_CODE_PATTERN,
  CreateTeamInput,
} from '../types';
import {
  currentUser,
  initialWorkspace,
  initialProjects,
  initialTasks,
  initialMeetings,
  initialNotifications,
  initialTeams,
  teamMembers,
  MockTeamRecord,
} from './mockData';
import { ApiError, USE_REAL_API } from './http';
import { teamApi } from './teamApi';
import { authApi } from './authApi';
import { projectTaskApi } from './projectTaskApi';
import { repoForPosition } from '../utils/github';
import { daysFromTodayISO, todayISO } from '../utils/dates';

const STORAGE_KEYS = {
  USER: 'flowmate_user',
  WORKSPACE: 'flowmate_workspace',
  PROJECTS: 'flowmate_projects',
  TEAMS: 'flowmate_teams',
  TASKS: 'flowmate_tasks',
  MEETINGS: 'flowmate_meetings',
  NOTIFICATIONS: 'flowmate_notifications',
  GITHUB_REPOS: 'flowmate_github_repos',
};

// Bump when mockData.ts changes story or shape: older seeded data is replaced on next start.
// (2: student teams - hackathon / finance competition / capstone, instead of company departments)
// (3: project members have a position and tech stack)
// (4: GitHub organization + repositories per position instead of a single repo)
const MOCK_DATA_VERSION = '4';
const MOCK_GITHUB_ORGS = ['Team-dAIving', 'team-bamsaem', 'quant-house'];
const MOCK_VERSION_KEY = 'flowmate_mock_version';
const MOCK_KEYS = [
  STORAGE_KEYS.USER,
  STORAGE_KEYS.WORKSPACE,
  STORAGE_KEYS.PROJECTS,
  STORAGE_KEYS.TEAMS,
  STORAGE_KEYS.TASKS,
  STORAGE_KEYS.MEETINGS,
  STORAGE_KEYS.NOTIFICATIONS,
];

// Initialize LocalStorage with mock data if empty (or seeded by an older mock version)
function initStorage() {
  if (localStorage.getItem(MOCK_VERSION_KEY) !== MOCK_DATA_VERSION) {
    MOCK_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(MOCK_VERSION_KEY, MOCK_DATA_VERSION);
  }
  if (!localStorage.getItem(STORAGE_KEYS.USER)) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
  }
  if (!localStorage.getItem(STORAGE_KEYS.WORKSPACE)) {
    localStorage.setItem(STORAGE_KEYS.WORKSPACE, JSON.stringify(initialWorkspace));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(initialProjects));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TEAMS)) {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(initialTeams));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(initialTasks));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MEETINGS)) {
    localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(initialMeetings));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(initialNotifications));
  }
}

if (!USE_REAL_API) initStorage();

// Shape a mock team record like the backend's GET /api/teams response
function mockRecordToTeam(t: MockTeamRecord, projects: Project[], tasks: Task[]): Team {
  const members = (t.memberIds || [])
    .map((id) => teamMembers.find((m) => m.id === id))
    .filter((m): m is User => Boolean(m))
    .map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl }));
  const teamProjects = (t.projectIds || [])
    .map((pid) => projects.find((p) => p.id === pid))
    .filter((p): p is Project => Boolean(p))
    .map((p) => ({ id: p.id, name: p.name, subject: p.goal || undefined }));
  const memberIdSet = new Set(members.map((m) => m.id));
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    color: t.color,
    members,
    memberIds: members.map((m) => m.id),
    memberCount: members.length,
    projects: teamProjects,
    projectIds: teamProjects.map((p) => p.id),
    inProgressTaskCount: tasks.filter(
      (task) => task.status === 'IN_PROGRESS' && task.assignee && memberIdSet.has(task.assignee.id)
    ).length,
  };
}

function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Real API mode (VITE_API_BASE_URL set, i.e. the deployed service): features the backend doesn't have yet
// return nothing or fail with this, instead of silently using local mock data.
export const NOT_CONNECTED_MESSAGE = '이 기능은 아직 서버와 연결되지 않아 사용할 수 없습니다.';
function notConnected(): never {
  throw new ApiError(501, NOT_CONNECTED_MESSAGE);
}

// API Service with real REST call capability and robust mock fallback
export const api = {
  // 1. Auth & User
  getCurrentUser: async (): Promise<User> => {
    if (USE_REAL_API) return (await authApi.getMe()).user;
    return getStored<User>(STORAGE_KEYS.USER, currentUser);
  },

  updateCurrentUser: async (user: Partial<User>): Promise<User> => {
    if (USE_REAL_API) {
      // The backend only allows changing the nickname (PATCH /api/auth/me/nickname)
      if (typeof user.name !== 'string') notConnected();
      return (await authApi.setNickname(user.name)).user;
    }
    const current = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const updated = { ...current, ...user };
    setStored(STORAGE_KEYS.USER, updated);
    return updated;
  },

  // 2. Workspace
  getWorkspaces: async (): Promise<Workspace[]> => {
    if (USE_REAL_API) return [];
    const ws = getStored<Workspace>(STORAGE_KEYS.WORKSPACE, initialWorkspace);
    return [ws];
  },

  // 3. Projects
  getProjects: async (): Promise<Project[]> => {
    if (USE_REAL_API) {
      // GET /api/projects has no goal; the backend's projects.subject (the goal) only comes with the teams
      const [projects, teams] = await Promise.all([projectTaskApi.getProjects(), teamApi.getTeams()]);
      const subjectById = new Map(teams.flatMap((t) => t.projects).map((p) => [p.id, p.subject]));
      return projects.map((p) => ({ ...p, goal: p.goal || subjectById.get(p.id) || '' }));
    }
    return getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
  },

  getProjectById: async (id: string): Promise<Project | undefined> => {
    if (USE_REAL_API) return (await projectTaskApi.getProjects()).find((p) => p.id === id);
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    return projects.find((p) => p.id === id);
  },

  createProject: async (projectData: Omit<Project, 'id' | 'createdAt' | 'progress'>): Promise<Project> => {
    if (USE_REAL_API) notConnected();
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const newProject: Project = {
      ...projectData,
      id: `proj-${Date.now()}`,
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [newProject, ...projects];
    setStored(STORAGE_KEYS.PROJECTS, updated);
    return newProject;
  },

  updateProject: async (id: string, updateData: Partial<Project>): Promise<Project> => {
    if (USE_REAL_API) notConnected();
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Project not found');
    projects[index] = { ...projects[index], ...updateData };
    setStored(STORAGE_KEYS.PROJECTS, projects);
    return projects[index];
  },

  // 3-1. Teams
  // VITE_API_BASE_URL set → backend (/api/teams, /api/users/code/{code}); otherwise local mock.
  // Only teams the current user belongs to are returned — the backend must enforce this server-side.
  getTeams: async (): Promise<Team[]> => {
    if (USE_REAL_API) return teamApi.getTeams();

    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const records = getStored<MockTeamRecord[]>(STORAGE_KEYS.TEAMS, initialTeams).filter((t) =>
      (t.memberIds || []).includes(me.id)
    );
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    return records.map((t) => mockRecordToTeam(t, projects, tasks));
  },

  getTeamById: async (id: string): Promise<Team | undefined> => {
    const teams = await api.getTeams();
    return teams.find((t) => t.id === id);
  },

  createTeam: async (input: CreateTeamInput): Promise<Team> => {
    if (USE_REAL_API) return teamApi.createTeam(input);

    const records = getStored<MockTeamRecord[]>(STORAGE_KEYS.TEAMS, initialTeams);
    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    // Creator is always a member; drop duplicates and unknown ids
    const memberIds = Array.from(new Set([me.id, ...(input.memberIds || [])])).filter((mid) =>
      teamMembers.some((m) => m.id === mid)
    );
    const record: MockTeamRecord = {
      id: `team-${Date.now()}`,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      memberIds,
      projectIds: [],
      color: input.color,
      createdAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.TEAMS, [record, ...records]);
    return mockRecordToTeam(
      record,
      getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects),
      getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks)
    );
  },

  // Link a project to a team. No backend endpoint exists yet (requested), so real mode is a no-op.
  linkProjectToTeam: async (teamId: string, projectId: string): Promise<void> => {
    if (USE_REAL_API) {
      console.warn('[api] 프로젝트-팀 연결 API가 아직 없어 연결을 건너뜁니다.', { teamId, projectId });
      return;
    }
    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const records = getStored<MockTeamRecord[]>(STORAGE_KEYS.TEAMS, initialTeams);
    const index = records.findIndex((t) => t.id === teamId);
    if (index === -1) throw new Error('Team not found');
    if (!(records[index].memberIds || []).includes(me.id)) throw new Error('Not a member of this team');
    records[index] = {
      ...records[index],
      projectIds: Array.from(new Set([...(records[index].projectIds || []), projectId])),
    };
    setStored(STORAGE_KEYS.TEAMS, records);
  },

  // Find a user by their 6-character user code (for team invitations).
  // Returns only public fields — email/department must not leak to someone who just guessed a code.
  findUserByCode: async (code: string): Promise<PublicUserProfile | null> => {
    if (USE_REAL_API) return teamApi.findUserByCode(code);

    const normalizedCode = code.trim().toUpperCase();
    if (!USER_CODE_PATTERN.test(normalizedCode)) return null;
    const found = teamMembers.find((m) => m.userCode?.toUpperCase() === normalizedCode);
    if (!found) return null;
    return { id: found.id, name: found.name, avatarUrl: found.avatarUrl, userCode: found.userCode };
  },

  // GitHub organizations the user can pick at project creation.
  // No backend endpoint yet: real mode returns [] and the form falls back to typing the org name.
  getGitHubOrganizations: async (): Promise<string[]> => {
    if (USE_REAL_API) return [];
    return [...MOCK_GITHUB_ORGS];
  },

  // 4. Tasks
  getTasks: async (projectId?: string): Promise<Task[]> => {
    // Backend lists tasks per team only (GET /api/teams/{id}): gather them across my teams
    if (USE_REAL_API) return projectTaskApi.getTasks((await teamApi.getTeams()).map((t) => t.id), projectId);
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    if (projectId) {
      return tasks.filter((t) => t.projectId === projectId);
    }
    return tasks;
  },

  createTask: async (taskData: Partial<Task>): Promise<Task> => {
    if (USE_REAL_API) notConnected();
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    // Never fall back to some other project: the task would silently land in the wrong team's board
    const project = projects.find((p) => p.id === taskData.projectId);
    if (!project) throw new Error('업무를 등록할 프로젝트를 찾을 수 없습니다.');

    const newTask: Task = {
      id: `task-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      title: taskData.title || '새로운 업무',
      description: taskData.description || '',
      assignee: taskData.assignee || currentUser,
      priority: taskData.priority || 'MEDIUM',
      status: taskData.status || 'TODO',
      startDate: taskData.startDate || todayISO(),
      dueDate: taskData.dueDate,
      estimatedHours: taskData.estimatedHours, // 0 is valid; undefined = not estimated
      actualHours: 0,
      comments: [],
      activities: [
        {
          id: `act-${Date.now()}`,
          user: currentUser,
          action: '업무를 생성했습니다.',
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newTask, ...tasks];
    setStored(STORAGE_KEYS.TASKS, updated);

    // Notify
    api.addNotification({
      type: 'TASK_ASSIGNED',
      title: '새로운 업무 등록',
      message: `"${newTask.title}" 업무가 등록되었습니다.`,
      linkUrl: `/tasks/${newTask.id}`,
    });

    return newTask;
  },

  updateTask: async (id: string, updateData: Partial<Task>): Promise<Task> => {
    if (USE_REAL_API) notConnected();
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Task not found');

    const oldTask = tasks[index];
    const activities = [...oldTask.activities];

    if (updateData.status && updateData.status !== oldTask.status) {
      activities.push({
        id: `act-${Date.now()}`,
        user: currentUser,
        action: `상태를 ${updateData.status}로 변경했습니다.`,
        timestamp: new Date().toISOString(),
      });
    }

    const updatedTask = {
      ...oldTask,
      ...updateData,
      activities,
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updatedTask;
    setStored(STORAGE_KEYS.TASKS, tasks);
    return updatedTask;
  },

  deleteTask: async (id: string): Promise<boolean> => {
    if (USE_REAL_API) {
      await projectTaskApi.deleteTask(id); // DELETE /api/tasks/{id}
      return true;
    }
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const filtered = tasks.filter((t) => t.id !== id);
    setStored(STORAGE_KEYS.TASKS, filtered);
    return true;
  },

  // Full task (description, dates, hours, comments, GitHub) — list items only carry a summary in real mode
  getTaskDetail: async (id: string): Promise<Task> => {
    if (USE_REAL_API) return projectTaskApi.getTaskDetail(id); // GET /api/tasks/{id}
    const task = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks).find((t) => t.id === id);
    if (!task) throw new Error('업무를 찾을 수 없습니다.');
    return task;
  },

  addTaskComment: async (taskId: string, content: string): Promise<TaskComment> => {
    if (USE_REAL_API) return projectTaskApi.addComment(taskId, content); // POST /api/tasks/{id}/comments
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) throw new Error('업무를 찾을 수 없습니다.');
    const comment: TaskComment = {
      id: `c-${Date.now()}`,
      user: getStored<User>(STORAGE_KEYS.USER, currentUser),
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    tasks[index] = { ...tasks[index], comments: [...tasks[index].comments, comment] };
    setStored(STORAGE_KEYS.TASKS, tasks);
    return comment;
  },

  // 5. GitHub Integration
  createGitHubIssue: async (taskId: string): Promise<Task> => {
    if (USE_REAL_API) notConnected();
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) throw new Error('Task not found');

    const task = tasks[index];
    // The issue goes to the repo of the assignee's part (백엔드 task -> 백엔드 repo), else a shared/first repo
    const project = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects).find((p) => p.id === task.projectId);
    const assigneePosition = project?.members.find((m) => m.user.id === task.assignee?.id)?.position;
    const repo = project ? repoForPosition(project, assigneePosition) : undefined;
    if (!repo) throw new Error('이 프로젝트에 연결된 GitHub 레포지토리가 없습니다.');
    const issueNumber = Math.floor(Math.random() * 80) + 20;
    const githubIssue = {
      id: Date.now(),
      number: issueNumber,
      title: task.title,
      htmlUrl: `${repo.htmlUrl}/issues/${issueNumber}`,
      state: 'open' as const,
      createdAt: new Date().toISOString(),
    };

    const updatedTask: Task = {
      ...task,
      githubIssue,
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updatedTask;
    setStored(STORAGE_KEYS.TASKS, tasks);

    api.addNotification({
      type: 'GITHUB_SYNCED',
      title: 'GitHub Issue 생성 완료',
      message: `"${task.title}" 업무가 GitHub Issue #${issueNumber}로 등록되었습니다.`,
      linkUrl: githubIssue.htmlUrl,
    });

    return updatedTask;
  },

  // 6. Meetings & AI Recording
  getMeetings: async (projectId?: string): Promise<Meeting[]> => {
    if (USE_REAL_API) return [];
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    if (projectId) {
      return meetings.filter((m) => m.projectId === projectId);
    }
    return meetings;
  },

  getMeetingById: async (id: string): Promise<Meeting | undefined> => {
    if (USE_REAL_API) return undefined;
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    return meetings.find((m) => m.id === id);
  },

  createMeeting: async (meetingData: Partial<Meeting>): Promise<Meeting> => {
    if (USE_REAL_API) notConnected();
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const project = projects.find((p) => p.id === meetingData.projectId);
    if (!project) throw new Error('회의를 저장할 프로젝트를 찾을 수 없습니다.');

    const newMeeting: Meeting = {
      id: `meet-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      title: meetingData.title || '새로운 회의',
      meetingDate: meetingData.meetingDate || todayISO(),
      // Default: that project's own team, not a fixed person (teammates differ per team)
      participants: meetingData.participants || (project.members || []).map((m) => m.user),
      status: 'RECORDED',
      audioDurationSeconds: meetingData.audioDurationSeconds || 0,
      createdAt: new Date().toISOString(),
      actionItems: [],
      transcript: [],
      decisions: [],
      summary: '',
    };

    const updated = [newMeeting, ...meetings];
    setStored(STORAGE_KEYS.MEETINGS, updated);
    return newMeeting;
  },

  // Simulate AI Analysis of recorded meeting (Transcribe + Bedrock)
  analyzeMeeting: async (meetingId: string): Promise<Meeting> => {
    if (USE_REAL_API) notConnected();
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    const index = meetings.findIndex((m) => m.id === meetingId);
    if (index === -1) throw new Error('Meeting not found');

    const meeting = meetings[index];

    // Mock AI result. Assign only people who were in this meeting (each team has different members).
    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const people = meeting.participants && meeting.participants.length > 0 ? meeting.participants : [me];
    const teammate = people.find((p) => p.id !== me.id) || people[0];
    const self = people.find((p) => p.id === me.id) || people[0];
    const simulatedActionItems: ActionItem[] = [
      {
        id: `ai-${Date.now()}-1`,
        meetingId: meeting.id,
        title: '회의에서 정한 역할 분담표 정리',
        description: '이번 회의에서 나눈 담당 파트와 다음 회의까지 할 일을 팀 노션에 정리',
        assigneeId: teammate.id,
        assigneeName: teammate.name,
        dueDate: daysFromTodayISO(2),
        priority: 'MEDIUM',
        approvalStatus: 'PENDING',
        syncStatus: 'NONE',
        sourceQuote: `${teammate.name}: 오늘 나눈 역할은 제가 정리해서 공유할게요.`,
      },
      {
        id: `ai-${Date.now()}-2`,
        meetingId: meeting.id,
        title: '제출 마감 전 최종 점검 일정 잡기',
        description: '마감 이틀 전까지 결과물 리허설과 제출 서류 확인 일정 확정',
        assigneeId: self.id,
        assigneeName: self.name,
        dueDate: daysFromTodayISO(4),
        priority: 'HIGH',
        approvalStatus: 'PENDING',
        syncStatus: 'NONE',
        sourceQuote: `${self.name}: 마감 직전에 몰리지 않게 리허설 날짜부터 정해요.`,
      },
    ];

    const analyzedMeeting: Meeting = {
      ...meeting,
      status: 'ANALYZED',
      summary:
        meeting.summary ||
        '팀원별 진행 상황을 공유하고 남은 기간의 역할을 나눔. AI가 뽑은 할 일은 팀원이 검토하고 승인한 것만 업무로 등록하기로 함.',
      decisions: meeting.decisions && meeting.decisions.length > 0 ? meeting.decisions : [
        'AI가 뽑은 할 일은 승인한 것만 업무로 등록',
        '마감 이틀 전에 최종 리허설 진행',
      ],
      actionItems: [...(meeting.actionItems || []), ...simulatedActionItems],
    };

    meetings[index] = analyzedMeeting;
    setStored(STORAGE_KEYS.MEETINGS, meetings);

    // Trigger notification
    api.addNotification({
      type: 'MEETING_ANALYZED',
      title: 'AI 회의록 분석 완료',
      message: `"${meeting.title}" 회의의 AI 분석이 완료되었습니다. Action Items를 확인하세요.`,
      linkUrl: `/meetings/${meeting.id}`,
    });

    return analyzedMeeting;
  },

  // 7. Approve AI Action Item
  approveActionItem: async (
    meetingId: string,
    actionItemId: string,
    options: {
      createGitHubIssue: boolean;
      customData?: Partial<ActionItem>;
    }
  ): Promise<{ task: Task; actionItem: ActionItem }> => {
    if (USE_REAL_API) notConnected();
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    const meetingIndex = meetings.findIndex((m) => m.id === meetingId);
    if (meetingIndex === -1) throw new Error('Meeting not found');

    const meeting = meetings[meetingIndex];
    const actionItemIndex = (meeting.actionItems || []).findIndex((ai) => ai.id === actionItemId);
    if (actionItemIndex === -1) throw new Error('Action item not found');

    const currentAI = meeting.actionItems![actionItemIndex];
    const mergedAI = { ...currentAI, ...options.customData };

    // Find assignee User
    const assignee = teamMembers.find((u) => u.id === mergedAI.assigneeId) || currentUser;

    // 1) Create FlowMate Task
    const createdTask = await api.createTask({
      projectId: meeting.projectId,
      title: mergedAI.title,
      description: `${mergedAI.description}\n\n> [회의록 발췌]: "${mergedAI.sourceQuote || '회의 결정 사항'}"\n(회의: ${meeting.title})`,
      assignee,
      priority: mergedAI.priority,
      status: 'TODO',
      dueDate: mergedAI.dueDate,
    });

    let syncStatus: 'NONE' | 'PENDING' | 'SUCCEEDED' | 'FAILED' = 'NONE';
    let issueUrl: string | undefined = undefined;

    // 2) Optional GitHub Issue creation
    if (options.createGitHubIssue) {
      try {
        const syncedTask = await api.createGitHubIssue(createdTask.id);
        syncStatus = 'SUCCEEDED';
        issueUrl = syncedTask.githubIssue?.htmlUrl;
      } catch (err) {
        console.error('GitHub issue sync failed:', err);
        syncStatus = 'FAILED';
      }
    }

    const updatedAI: ActionItem = {
      ...mergedAI,
      approvalStatus: 'APPROVED',
      syncStatus,
      createdTaskId: createdTask.id,
      githubIssueUrl: issueUrl,
    };

    meeting.actionItems![actionItemIndex] = updatedAI;
    meetings[meetingIndex] = meeting;
    setStored(STORAGE_KEYS.MEETINGS, meetings);

    return { task: createdTask, actionItem: updatedAI };
  },

  rejectActionItem: async (meetingId: string, actionItemId: string): Promise<ActionItem> => {
    if (USE_REAL_API) notConnected();
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    const meetingIndex = meetings.findIndex((m) => m.id === meetingId);
    if (meetingIndex === -1) throw new Error('Meeting not found');

    const meeting = meetings[meetingIndex];
    const actionItemIndex = (meeting.actionItems || []).findIndex((ai) => ai.id === actionItemId);
    if (actionItemIndex === -1) throw new Error('Action item not found');

    const updatedAI: ActionItem = {
      ...meeting.actionItems![actionItemIndex],
      approvalStatus: 'REJECTED',
    };

    meeting.actionItems![actionItemIndex] = updatedAI;
    meetings[meetingIndex] = meeting;
    setStored(STORAGE_KEYS.MEETINGS, meetings);
    return updatedAI;
  },

  // 8. Notifications
  getNotifications: async (): Promise<Notification[]> => {
    if (USE_REAL_API) return [];
    return getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
  },

  addNotification: (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>): Notification => {
    if (USE_REAL_API) {
      return { ...notif, id: `notif-${Date.now()}`, read: false, createdAt: new Date().toISOString() };
    }
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
    const newNotif: Notification = {
      ...notif,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newNotif, ...notifs];
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);

    // If running in Electron, trigger native desktop notification!
    if (window.electronAPI) {
      window.electronAPI.showNotification(newNotif.title, newNotif.message);
    }

    return newNotif;
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    if (USE_REAL_API) return;
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
    const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  markAllNotificationsAsRead: async (): Promise<void> => {
    if (USE_REAL_API) return;
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);
  },
};
