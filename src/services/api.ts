import {
  User,
  Workspace,
  Project,
  Task,
  Meeting,
  Notification,
  ActionItem,
  GitHubRepository,
  Team,
  PublicUserProfile,
  USER_CODE_PATTERN,
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
} from './mockData';

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

// Initialize LocalStorage with mock data if empty
function initStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.USER)) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
  } else {
    // Migration: users stored before userCode existed would never see their code on the dashboard
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER)!) as User;
      if (!stored.userCode || stored.userCode !== currentUser.userCode) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ ...stored, userCode: currentUser.userCode }));
      }
    } catch {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    }
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

initStorage();

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

// API Service with real REST call capability and robust mock fallback
export const api = {
  // 1. Auth & User
  getCurrentUser: async (): Promise<User> => {
    return getStored<User>(STORAGE_KEYS.USER, currentUser);
  },

  updateCurrentUser: async (user: Partial<User>): Promise<User> => {
    const current = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const updated = { ...current, ...user };
    setStored(STORAGE_KEYS.USER, updated);
    return updated;
  },

  // 2. Workspace
  getWorkspaces: async (): Promise<Workspace[]> => {
    const ws = getStored<Workspace>(STORAGE_KEYS.WORKSPACE, initialWorkspace);
    return [ws];
  },

  // 3. Projects
  getProjects: async (): Promise<Project[]> => {
    return getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
  },

  getProjectById: async (id: string): Promise<Project | undefined> => {
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    return projects.find((p) => p.id === id);
  },

  createProject: async (projectData: Omit<Project, 'id' | 'createdAt' | 'progress'>): Promise<Project> => {
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
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Project not found');
    projects[index] = { ...projects[index], ...updateData };
    setStored(STORAGE_KEYS.PROJECTS, projects);
    return projects[index];
  },

  // 3-1. Teams
  // Only teams the current user belongs to — other people's teams must not be visible.
  // (Real backend must enforce this server-side; filtering here is only for the mock.)
  getTeams: async (): Promise<Team[]> => {
    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const teams = getStored<Team[]>(STORAGE_KEYS.TEAMS, initialTeams).filter((t) =>
      (t.memberIds || []).includes(me.id)
    );
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    return teams.map((t) => ({
      ...t,
      members: (t.memberIds || []).map((id) => teamMembers.find((m) => m.id === id)!).filter(Boolean),
      projects: (t.projectIds || []).map((pid) => projects.find((p) => p.id === pid)!).filter(Boolean),
    }));
  },

  getTeamById: async (id: string): Promise<Team | undefined> => {
    const teams = await api.getTeams();
    return teams.find((t) => t.id === id);
  },

  createTeam: async (teamData: Omit<Team, 'id' | 'createdAt' | 'members' | 'projects'>): Promise<Team> => {
    const teams = getStored<Team[]>(STORAGE_KEYS.TEAMS, initialTeams);
    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    // Creator is always a member; drop duplicates and unknown ids
    const memberIds = Array.from(new Set([me.id, ...(teamData.memberIds || [])])).filter((mid) =>
      teamMembers.some((m) => m.id === mid)
    );
    const newTeam: Team = {
      ...teamData,
      id: `team-${Date.now()}`,
      memberIds,
      members: memberIds.map((mid) => teamMembers.find((m) => m.id === mid)!).filter(Boolean),
      projectIds: teamData.projectIds || [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newTeam, ...teams];
    setStored(STORAGE_KEYS.TEAMS, updated);
    return newTeam;
  },

  updateTeam: async (id: string, updateData: Partial<Team>): Promise<Team> => {
    const teams = getStored<Team[]>(STORAGE_KEYS.TEAMS, initialTeams);
    const index = teams.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Team not found');
    teams[index] = { ...teams[index], ...updateData };
    setStored(STORAGE_KEYS.TEAMS, teams);
    return teams[index];
  },

  // Link a project to a team using fresh stored data (no stale UI state, no duplicate ids)
  linkProjectToTeam: async (teamId: string, projectId: string): Promise<Team> => {
    const me = getStored<User>(STORAGE_KEYS.USER, currentUser);
    const teams = getStored<Team[]>(STORAGE_KEYS.TEAMS, initialTeams);
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error('Team not found');
    if (!(team.memberIds || []).includes(me.id)) throw new Error('Not a member of this team');
    const projectIds = Array.from(new Set([...(team.projectIds || []), projectId]));
    return api.updateTeam(teamId, { projectIds });
  },

  // Find a user by their 6-character user code (for team invitations).
  // Returns only public fields — email/department must not leak to someone who just guessed a code.
  findUserByCode: async (code: string): Promise<PublicUserProfile | null> => {
    const normalizedCode = code.trim().toUpperCase();
    if (!USER_CODE_PATTERN.test(normalizedCode)) return null;
    const found = teamMembers.find((m) => m.userCode?.toUpperCase() === normalizedCode);
    if (!found) return null;
    return { id: found.id, name: found.name, avatarUrl: found.avatarUrl, userCode: found.userCode };
  },

  // 4. Tasks
  getTasks: async (projectId?: string): Promise<Task[]> => {
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    if (projectId) {
      return tasks.filter((t) => t.projectId === projectId);
    }
    return tasks;
  },

  createTask: async (taskData: Partial<Task>): Promise<Task> => {
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const project = projects.find((p) => p.id === taskData.projectId) || projects[0];

    const count = tasks.length + 101;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      issueKey: `${project.key || 'FM'}-${count}`,
      projectId: project.id,
      projectName: project.name,
      title: taskData.title || '새로운 업무',
      description: taskData.description || '',
      assignee: taskData.assignee || currentUser,
      priority: taskData.priority || 'MEDIUM',
      status: taskData.status || 'TODO',
      startDate: taskData.startDate || new Date().toISOString().split('T')[0],
      dueDate: taskData.dueDate,
      estimatedHours: taskData.estimatedHours || 8,
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
      message: `${newTask.issueKey}: "${newTask.title}" 업무가 등록되었습니다.`,
      linkUrl: `/tasks/${newTask.id}`,
    });

    return newTask;
  },

  updateTask: async (id: string, updateData: Partial<Task>): Promise<Task> => {
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
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const filtered = tasks.filter((t) => t.id !== id);
    setStored(STORAGE_KEYS.TASKS, filtered);
    return true;
  },

  // 5. GitHub Integration
  createGitHubIssue: async (taskId: string): Promise<Task> => {
    const tasks = getStored<Task[]>(STORAGE_KEYS.TASKS, initialTasks);
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) throw new Error('Task not found');

    const task = tasks[index];
    const issueNumber = Math.floor(Math.random() * 80) + 20;
    const githubIssue = {
      id: Date.now(),
      number: issueNumber,
      title: `${task.issueKey}: ${task.title}`,
      htmlUrl: `https://github.com/dAIving/FlowMate-Core/issues/${issueNumber}`,
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
      message: `${task.issueKey} 업무가 GitHub Issue #${issueNumber}로 등록되었습니다.`,
      linkUrl: githubIssue.htmlUrl,
    });

    return updatedTask;
  },

  // 6. Meetings & AI Recording
  getMeetings: async (projectId?: string): Promise<Meeting[]> => {
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    if (projectId) {
      return meetings.filter((m) => m.projectId === projectId);
    }
    return meetings;
  },

  getMeetingById: async (id: string): Promise<Meeting | undefined> => {
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    return meetings.find((m) => m.id === id);
  },

  createMeeting: async (meetingData: Partial<Meeting>): Promise<Meeting> => {
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, initialProjects);
    const project = projects.find((p) => p.id === meetingData.projectId) || projects[0];

    const newMeeting: Meeting = {
      id: `meet-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      title: meetingData.title || '새로운 회의',
      meetingDate: meetingData.meetingDate || new Date().toISOString().split('T')[0],
      participants: meetingData.participants || [currentUser, teamMembers[1]],
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
    const meetings = getStored<Meeting[]>(STORAGE_KEYS.MEETINGS, initialMeetings);
    const index = meetings.findIndex((m) => m.id === meetingId);
    if (index === -1) throw new Error('Meeting not found');

    const meeting = meetings[index];

    // Mock Bedrock extracted result
    const simulatedActionItems: ActionItem[] = [
      {
        id: `ai-${Date.now()}-1`,
        meetingId: meeting.id,
        title: '회의 분석 결과 검토 화면 스타일 가이드 준수 확인',
        description: 'Linear/VSCode 미니멀 테마 및 JetBrains Mono 폰트 배지 적용',
        assigneeId: teamMembers[2].id,
        assigneeName: teamMembers[2].name,
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        priority: 'HIGH',
        approvalStatus: 'PENDING',
        syncStatus: 'NONE',
        sourceQuote: '정디자인: 개발자 친화적인 다크/라이트 테마와 상태 배지가 명확하게 보이도록 정리했습니다.',
      },
      {
        id: `ai-${Date.now()}-2`,
        meetingId: meeting.id,
        title: 'Electron 트레이 및 단축키 전역 리스너 최적화',
        description: '시스템 단축키 CommandOrControl+Alt+K 반응 속도 점검',
        assigneeId: teamMembers[0].id,
        assigneeName: teamMembers[0].name,
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
        priority: 'MEDIUM',
        approvalStatus: 'PENDING',
        syncStatus: 'NONE',
        sourceQuote: '이아키: 단축키는 어디서나 즉시 호출될 수 있도록 전역으로 등록해야 합니다.',
      },
    ];

    const analyzedMeeting: Meeting = {
      ...meeting,
      status: 'ANALYZED',
      summary:
        meeting.summary ||
        '회의를 통해 실시간 오디오 녹음 파이프라인과 Bedrock 모델 기반의 Action Items 추출 테스트를 완료함. 모든 추출 업무는 검토 후 수동 승인을 거쳐 생성하기로 확정.',
      decisions: meeting.decisions && meeting.decisions.length > 0 ? meeting.decisions : [
        'AI 분석 결과는 사용자 승인 후 실제 작업으로 등록',
        'Spring Boot 및 AWS 인프라 환경 변수 분리 철저',
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
    return getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
  },

  addNotification: (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>): Notification => {
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
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
    const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  markAllNotificationsAsRead: async (): Promise<void> => {
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);
  },
};
