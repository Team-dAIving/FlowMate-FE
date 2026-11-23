import { addDays, format } from 'date-fns';
import { Task } from '../types';

// Dates are stored as local calendar days ("yyyy-MM-dd").
// Never derive them from toISOString(): that is UTC, so in Korea (UTC+9) anything before 09:00 lands on yesterday.

/** Today as yyyy-MM-dd in the user's local time zone. */
export const todayISO = (): string => format(new Date(), 'yyyy-MM-dd');

/** n days from today, yyyy-MM-dd, local time. */
export const daysFromTodayISO = (n: number): string => format(addDays(new Date(), n), 'yyyy-MM-dd');

/** The local calendar day (yyyy-MM-dd) of a timestamp such as 2026-11-19T15:30:00Z. */
export const localDayOf = (iso: string): string => format(new Date(iso), 'yyyy-MM-dd');

/** Past due and still open (not done, not cancelled). Due today is not overdue. */
export const isOverdue = (task: Pick<Task, 'dueDate' | 'status'>): boolean =>
  Boolean(task.dueDate) && task.status !== 'DONE' && task.status !== 'CANCELLED' && task.dueDate!.slice(0, 10) < todayISO();
