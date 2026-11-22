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

export interface ProjectRepository {
  id: string; // "owner/name" lowercased
  position?: ProjectPosition; // undefined = shared by the whole project (e.g. a monorepo)
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
}

// What a member does in this project (independent of the permission role)
export type ProjectPosition = 'BACKEND' | 'FRONTEND' | 'DESIGN' | 'PM' | 'ETC';

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
  description: string;
  goal: string;
  startDate: string;
  endDate: string;
  projectType: ProjectType;
  techStack: string[];
  members: ProjectMember[];
  // Project leader (user id). Leader is a per-project concept, not a team one.
  // Older records without it fall back to the member with role OWNER (see utils/projectLeader).
  leaderId?: string;
  // GitHub organization the project's repos live in (optional: repos may also be "owner/repo")
  githubOrg?: string;
  // One or more repos, each optionally tied to a part of the project (백엔드 repo, 프론트 repo, ...)
  repositories?: ProjectRepository[];
  progress: number; // 0 to 100
  createdAt: string;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
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
  summary?: string;
  decisions?: string[];
  actionItems?: ActionItem[];
  transcript?: TranscriptSegment[];
  createdAt: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS'
  | 'MEETING_ANALYZED'
  | 'APPROVAL_REQUIRED'
  | 'GITHUB_SYNCED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  linkUrl?: string;
  createdAt: string;
}
