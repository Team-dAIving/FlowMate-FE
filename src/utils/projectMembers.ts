import { Project, User } from '../types';

const dedupeUsers = (users: User[]): User[] => {
  const seen = new Set<string>();
  return users.filter((u) => {
    if (!u || seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
};

/**
 * Members of a single project — the only people who may be picked as assignee in that project.
 * Falls back to the current user so selects are never empty.
 */
export function getProjectMemberUsers(project: Project | undefined, currentUser: User | null): User[] {
  const users = dedupeUsers((project?.members || []).map((m) => m.user));
  if (users.length === 0 && currentUser) return [currentUser];
  return users;
}

/** Projects the current user actually belongs to. */
export function getMyProjects(projects: Project[], currentUser: User | null): Project[] {
  if (!currentUser) return [];
  return projects.filter((p) => (p.members || []).some((m) => m.user?.id === currentUser.id));
}

/** Union of members across the projects the current user belongs to (people I collaborate with). */
export function getCollaboratorUsers(projects: Project[], currentUser: User | null): User[] {
  const users = dedupeUsers(getMyProjects(projects, currentUser).flatMap((p) => (p.members || []).map((m) => m.user)));
  if (users.length === 0 && currentUser) return [currentUser];
  return users;
}
