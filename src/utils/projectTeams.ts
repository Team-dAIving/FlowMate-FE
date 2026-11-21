import { Project, Task } from '../types';

export interface ProjectTaskGroup {
  projectId: string;
  project?: Project;
  tasks: Task[];
}

/**
 * Split tasks by project. Order follows the project list; tasks whose project
 * is unknown go last so nothing silently disappears.
 */
export function groupTasksByProject(tasks: Task[], projects: Project[]): ProjectTaskGroup[] {
  const byProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = byProject.get(t.projectId);
    if (list) list.push(t);
    else byProject.set(t.projectId, [t]);
  }

  const groups: ProjectTaskGroup[] = [];
  for (const p of projects) {
    const list = byProject.get(p.id);
    if (list) {
      groups.push({ projectId: p.id, project: p, tasks: list });
      byProject.delete(p.id);
    }
  }
  for (const [projectId, list] of byProject) {
    groups.push({ projectId, tasks: list });
  }
  return groups;
}
