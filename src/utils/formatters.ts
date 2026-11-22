import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatDate(dateString?: string | null, formatStr: string = 'yyyy-MM-dd'): string {
  if (!dateString) return '-';
  try {
    const d = parseISO(dateString);
    if (!isValid(d)) return dateString;
    return format(d, formatStr);
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const d = parseISO(dateString);
    if (!isValid(d)) return '';
    return formatDistanceToNow(d, { addSuffix: true, locale: ko });
  } catch {
    return '';
  }
}

export function formatDuration(seconds: number): string {
  // Stored durations can be fractional or missing; show whole seconds ("02:05", not "02:05.333")
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
