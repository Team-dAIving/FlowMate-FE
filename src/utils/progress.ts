import { Task } from '../types';

/**
 * Project progress = share of its tasks that are DONE (0 when it has no tasks yet).
 * One definition everywhere, so the dashboard, project list, project detail and team pages agree.
 */
export function projectProgress(projectId: string, tasks: Task[]): number {
  const mine = tasks.filter((t) => t.projectId === projectId);
  if (mine.length === 0) return 0;
  return Math.round((mine.filter((t) => t.status === 'DONE').length / mine.length) * 100);
}
