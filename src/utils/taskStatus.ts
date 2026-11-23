import { TaskStatus } from '../types';
import { USE_REAL_API } from '../services/http';

export const STATUS_META: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  TODO: { label: 'TODO', color: '#94A3B8', dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'IN PROGRESS', color: '#3B82F6', dot: 'bg-blue-500' },
  IN_REVIEW: { label: 'IN REVIEW', color: '#F59E0B', dot: 'bg-amber-500' },
  DONE: { label: 'DONE', color: '#10B981', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'CANCELLED', color: '#9CA3AF', dot: 'bg-gray-400' },
};

/**
 * Statuses the current data source uses. The backend has TODO, IN_PROGRESS, DONE, CANCELLED
 * (no review step); local mock data still has IN_REVIEW.
 */
export const TASK_STATUSES: TaskStatus[] = USE_REAL_API
  ? ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
  : ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/** Counts per status, every status present (0 if none). */
export function countByStatus(tasks: { status: TaskStatus }[]): Record<TaskStatus, number> {
  const counts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, CANCELLED: 0 };
  for (const t of tasks) counts[t.status] += 1;
  return counts;
}

/** Still to be worked on (not done, not cancelled). */
export const isOpenStatus = (s: TaskStatus) => s !== 'DONE' && s !== 'CANCELLED';
