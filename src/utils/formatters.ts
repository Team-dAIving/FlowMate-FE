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
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
