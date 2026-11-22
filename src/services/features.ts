import { USE_REAL_API } from './http';

// Which features the backend actually serves (FlowMate-BE dev branch). Without VITE_API_BASE_URL
// (local dev) everything runs on mock data; with it (the deployed service) a feature is only usable
// once its API exists. Flip a flag to true when the backend ships it (and wire it in services/api.ts).
const SERVER_FEATURES = {
  auth: true, // GET /api/auth/me, PATCH /api/auth/me/nickname, POST /api/auth/logout
  teams: true, // GET/POST /api/teams, GET /api/teams/{id}, GET /api/users/code/{code}
  projects: true, // GET /api/projects (read)
  projectWrite: false, // create / edit project, members, roles, repos, leader — no endpoint yet
  tasks: true, // task list via GET /api/teams/{id}, GET /api/tasks/{id}
  taskWrite: false, // create task, change status/priority/assignee/dates — no endpoint yet
  taskComments: true, // POST /api/tasks/{id}/comments
  taskDelete: true, // DELETE /api/tasks/{id}
  meetings: false, // recording upload, STT/AI analysis, action items
  notifications: false,
  github: false, // org list, issue creation
} as const;

export type Feature = keyof typeof SERVER_FEATURES;

export const isFeatureAvailable = (f: Feature): boolean => !USE_REAL_API || SERVER_FEATURES[f];
