import React from 'react';
import { cn } from '../../utils/cn';
import { TaskPriority, TaskStatus, ApprovalStatus, GitHubSyncStatus } from '../../types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'status' | 'priority' | 'tech';
  status?: TaskStatus;
  priority?: TaskPriority;
  approval?: ApprovalStatus;
  sync?: GitHubSyncStatus;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  status,
  priority,
  approval,
  sync,
  children,
  ...props
}) => {
  if (status) {
    const statusConfig: Record<TaskStatus, { label: string; bg: string; text: string; dot: string }> = {
      TODO: {
        label: 'TODO',
        bg: 'bg-slate-100 dark:bg-slate-800/60',
        text: 'text-slate-700 dark:text-slate-300',
        dot: 'bg-slate-400',
      },
      IN_PROGRESS: {
        label: 'IN PROGRESS',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500 animate-pulse',
      },
      IN_REVIEW: {
        label: 'IN REVIEW',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
      },
      DONE: {
        label: 'DONE',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      },
    };

    const cfg = statusConfig[status];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-border/40',
          cfg.bg,
          cfg.text,
          className
        )}
        {...props}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
        {children || cfg.label}
      </span>
    );
  }

  if (priority) {
    const priorityConfig: Record<TaskPriority, { label: string; text: string; bg: string }> = {
      LOW: {
        label: 'Low',
        text: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-800/80',
      },
      MEDIUM: {
        label: 'Medium',
        text: 'text-sky-600 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-950/50',
      },
      HIGH: {
        label: 'High',
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/50',
      },
      URGENT: {
        label: 'Urgent',
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950/50',
      },
    };

    const cfg = priorityConfig[priority];
    return (
      <span
        className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium font-mono border border-border/50 uppercase tracking-wider',
          cfg.bg,
          cfg.text,
          className
        )}
        {...props}
      >
        {children || cfg.label}
      </span>
    );
  }

  if (approval) {
    const approvalConfig: Record<ApprovalStatus, { label: string; text: string; bg: string }> = {
      PENDING: {
        label: '승인 대기',
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-100 dark:bg-amber-900/40',
      },
      APPROVED: {
        label: '승인됨',
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      },
      REJECTED: {
        label: '거절됨',
        text: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-100 dark:bg-red-900/40',
      },
    };
    const cfg = approvalConfig[approval];
    return (
      <span
        className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', cfg.bg, cfg.text, className)}
        {...props}
      >
        {children || cfg.label}
      </span>
    );
  }

  if (sync) {
    const syncConfig: Record<GitHubSyncStatus, { label: string; text: string; bg: string }> = {
      NONE: { label: '미연동', text: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
      PENDING: { label: '동기화 중', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
      SUCCEEDED: { label: 'GitHub 연결됨', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
      FAILED: { label: '동기화 실패', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40' },
    };
    const cfg = syncConfig[sync];
    return (
      <span
        className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium', cfg.bg, cfg.text, className)}
        {...props}
      >
        {children || cfg.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-hover text-text-secondary border border-border',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
