import { Project, User } from '../types';

/** Project leader: explicit leaderId first, then the member with role OWNER (legacy data). */
export function getProjectLeader(project: Project | undefined): User | undefined {
  if (!project) return undefined;
  const members = project.members || [];
  if (project.leaderId) {
    const byId = members.find((m) => m.user?.id === project.leaderId);
    if (byId) return byId.user;
  }
  return members.find((m) => m.role === 'OWNER')?.user;
}
