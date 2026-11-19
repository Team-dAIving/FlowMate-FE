export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  department?: string;
}

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

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  leadId: string;
  lead?: User;
  memberIds: string[];
  members: User[];
  projectIds: string[];
  projects?: Project[];
  color?: string;
  createdAt: string;
}

export type ProjectType = 'WEB' | 'APP' | 'AI' | 'EMBEDDED' | 'OTHER';

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  isPrivate: boolean;
  defaultBranch: string;
  stars?: number;
}

export interface ProjectMember {
  user: User;
  role: UserRole;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string; // e.g. FM
  description: string;
  goal: string;
  startDate: string;
  endDate: string;
  projectType: ProjectType;
  techStack: string[];
  members: ProjectMember[];
  githubRepo?: GitHubRepository;
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
  issueKey: string; // e.g. FM-101
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
