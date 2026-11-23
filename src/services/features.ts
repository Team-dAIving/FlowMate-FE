import { USE_REAL_API } from './http';

// Which features the backend actually serves (FlowMate-BE dev branch). Without VITE_API_BASE_URL
// (local dev) everything runs on mock data; with it (the deployed service) a feature is only usable
// once its API exists. Flip a flag to true when the backend ships it (and wire it in services/api.ts).
const SERVER_FEATURES = {
  auth: true, // GET /api/auth/me, PATCH /api/auth/me/nickname, POST /api/auth/logout
  teams: true, // GET/POST /api/teams, GET /api/teams/{id}, GET /api/users/code/{code}
  projects: true, // GET /api/projects, GET /api/projects/{id}
  projectCreate: true, // POST /api/projects
  projectWrite: false, // edit a project after creation (info, members, roles, repos, leader): no endpoint yet
  githubApp: true, // GET /api/github/installations, POST /api/github/installations/start
  aiIssueDrafts: true, // POST /api/projects/issue-drafts (drafts only, nothing is saved)
  aiIssueRegister: true, // POST /api/projects/{id}/tasks (bulk-register drafts + GitHub issues)
  personalProject: false, // a project without a team: POST /api/projects still requires teamId
  tasks: true, // task list via GET /api/teams/{id}, GET /api/tasks/{id}
  taskCreate: true, // POST /api/projects/{id}/tasks/manual (+ optional GitHub issue in a chosen repo)
  taskWrite: false, // change status/priority/assignee/dates of an existing task: no endpoint yet
  taskComments: true, // POST /api/tasks/{id}/comments
  taskDelete: true, // DELETE /api/tasks/{id}
  meetings: true, // GET /api/projects/{id}/meetings (list: title, summary, status, approved item count)
  meetingWrite: false, // recording upload, STT/AI analysis, meeting detail with action items and transcript
  notifications: false,
  github: false, // creating a GitHub issue from a task
} as const;

export type Feature = keyof typeof SERVER_FEATURES;

export const isFeatureAvailable = (f: Feature): boolean => !USE_REAL_API || SERVER_FEATURES[f];
