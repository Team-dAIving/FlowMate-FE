export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  department?: string;
  githubLogin?: string; // GitHub account the user signed in with
  // 6자리 자동생성 코드 (예: "K7Q2XM") — 팀 초대 시 사용.
  // 순차값(FM0001...)이면 전체 유저를 열거할 수 있으므로 서버에서 랜덤·유니크하게 생성해야 함.
  userCode?: string;
}

// 유저 코드 조회 결과로 노출할 최소 정보 (이메일·소속 등 개인정보 제외)
export type PublicUserProfile = Pick<User, 'id' | 'name' | 'avatarUrl' | 'userCode'>;

export const USER_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
}

export interface WorkspaceMember {
  user: User;
  role: UserRole;
  joinedAt: string;
}

// 팀 응답에 포함되는 멤버 요약 (백엔드: { userId, nickname, avatarUrl })
export interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
}

// 팀 응답에 포함되는 프로젝트 요약 (백엔드: { id, name, subject })
export interface TeamProjectSummary {
  id: string;
  name: string;
  // Project goal/summary (backend 'subject'), e.g. '개발팀의 업무 분배, 일정 관리 ...'
  subject?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  members: TeamMember[];
  memberCount: number;
  projectIds: string[];
  projects: TeamProjectSummary[];
  color?: string;
  inProgressTaskCount?: number; // 백엔드가 계산한 IN_PROGRESS 업무 수
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  color: string; // #RRGGBB
  memberIds: string[];
}

export const TEAM_LIMITS = {
  NAME_MAX: 100,
  DESCRIPTION_MAX: 2000,
  MEMBERS_MAX: 100,
} as const;

export type ProjectType = 'WEB' | 'APP' | 'AI' | 'EMBEDDED' | 'OTHER';

// Which part of the project a repo belongs to (backend: common | backend | frontend | ai; at most one common)
export type RepoRole = 'COMMON' | 'BACKEND' | 'FRONTEND' | 'AI';

export interface ProjectRepository {
  id: string; // "owner/name" lowercased
  role: RepoRole;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  // Set for repos picked from a GitHub App installation (required by POST /api/projects)
  installationId?: string;
  githubRepositoryId?: string;
}

// A GitHub account/organization where the FlowMate GitHub App is installed (GET /api/github/installations)
export interface GitHubInstallation {
  installationId: string;
  accountLogin: string;
  accountType: string; // "Organization" | "User"
  repositories: {
    id: string;
    owner: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    private: boolean;
  }[];
}

// What a member does in this project (independent of the permission role)
export type ProjectPosition = 'BACKEND' | 'FRONTEND' | 'FULLSTACK' | 'DESIGN' | 'PM' | 'INFRA' | 'ETC';

export interface ProjectMember {
  user: User;
  role: UserRole; // permission (OWNER/ADMIN/MEMBER/VIEWER)
  position?: ProjectPosition;
  skills?: string[]; // tech stack this member uses in this project
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string; // short summary
  goal: string;
  designText?: string; // project design document (plain text for now); fed to AI issue drafts
  startDate: string;
  endDate: string;
  projectType: ProjectType;
  techStack: string[];
  members: ProjectMember[];
  // Project leader (user id). Leader is a per-project concept, not a team one.
  // Older records without it fall back to the member with role OWNER (see utils/projectLeader).
  leaderId?: string;
  teamId?: string; // team the project belongs to (the backend requires one)
  // GitHub organization the project's repos live in (optional: repos may also be "owner/repo")
  githubOrg?: string;
  // One or more repos, each optionally tied to a part of the project (백엔드 repo, 프론트 repo, ...)
  repositories?: ProjectRepository[];
  progress: number; // 0 to 100
  createdAt: string;
}

// What POST /api/projects needs (the server adds nothing: the creator and the leader must be in members,
// and every member must belong to the team)
export interface CreateProjectInput {
  name: string;
  description: string;
  goal: string;
  designText: string;
  projectType: ProjectType;
  startDate: string;
  endDate: string;
  teamId?: string; // none = personal project (only me)
  leaderId: string;
  members: { user: User; position: ProjectPosition; skills: string[] }[];
  additionalTechStack: string[];
  repositories: ProjectRepository[];
}

export const PROJECT_LIMITS = {
  NAME_MAX: 200,
  DESCRIPTION_MAX: 5000,
  GOAL_MAX: 2000,
  DESIGN_TEXT_MAX: 50000,
} as const;

// One AI-suggested task (POST /api/projects/issue-drafts), editable before it is registered
export interface IssueDraft {
  key: string; // client-side id for editing the list
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId?: string;
  startDate: string;
  dueDate: string;
  estimatedHours?: number;
  labels: string[];
  createGithubIssue: boolean;
  githubRepositoryId?: string; // which repo gets the issue (set when registering)
}

// Backend: TODO, IN_PROGRESS, DONE, CANCELLED. IN_REVIEW exists only in local mock data.
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  state: 'open' | 'closed';
  createdAt?: string;
}

export interface TaskComment {
  id: string;
  user: User;
  content: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  user: User;
  action: string;
  timestamp: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description: string;
  assignee?: User;
  priority: TaskPriority;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  githubIssue?: GitHubIssue;
  completedAt?: string;
  commentCount?: number; // from list responses (comments themselves come with the detail)
  comments: TaskComment[];
  activities: TaskActivity[];
  createdAt: string;
  updatedAt: string;
}

export type MeetingStatus = 'RECORDING' | 'RECORDED' | 'TRANSCRIBING' | 'ANALYZED' | 'FAILED';

export interface TranscriptSegment {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type GitHubSyncStatus = 'NONE' | 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface ActionItem {
  id: string;
  meetingId: string;
  title: string;
  description: string;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  priority: TaskPriority;
  approvalStatus: ApprovalStatus;
  syncStatus: GitHubSyncStatus;
  sourceQuote?: string; // Transcript segment citation
  createdTaskId?: string;
  githubIssueUrl?: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  meetingDate: string;
  participants: User[];
  audioUrl?: string;
  audioDurationSeconds?: number;
  status: MeetingStatus;
  failureReason?: string;
  transcriptionJobId?: string;
  summary?: string;
  decisions?: string[];
  actionItems?: ActionItem[];
  approvedActionItemCount?: number; // list responses only carry the count
  transcript?: TranscriptSegment[];
  createdAt: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS'
  | 'MEETING_ANALYZED'
  | 'APPROVAL_REQUIRED'
  | 'GITHUB_SYNCED';

// GET /api/projects/{id}: what the project's Overview dashboard shows
export interface ProjectDashboard {
  startDate?: string;
  endDate?: string;
  progressPercent: number;
  totalTaskCount: number;
  completedTaskCount: number;
  statusCounts: Record<TaskStatus, number>;
  workload: { userId: string; name: string; avatarUrl?: string; active: number; done: number }[];
  velocity: { date: string; completed: number }[]; // last 7 days
  counts: { tasks: number; meetings: number; members: number };
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  linkUrl?: string;
  createdAt: string;
}
