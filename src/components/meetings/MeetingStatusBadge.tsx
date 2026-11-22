import React from 'react';
import { MeetingStatus } from '../../types';
import { cn } from '../../utils/cn';

// One badge for every screen, covering every status (FAILED/TRANSCRIBING used to show as "AI 분석 완료")
const STYLES: Record<MeetingStatus, { label: string; className: string }> = {
  RECORDING: { label: '녹음 중', className: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300' },
  RECORDED: { label: '녹음 완료', className: 'bg-surface-hover text-text-muted' },
  TRANSCRIBING: { label: 'AI 분석 중', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  ANALYZED: { label: 'AI 분석 완료', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  FAILED: { label: '분석 실패', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
};

export const MeetingStatusBadge: React.FC<{ status: MeetingStatus; className?: string }> = ({ status, className }) => {
  const s = STYLES[status] ?? STYLES.RECORDED;
  return (
    <span className={cn('inline-flex items-center shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', s.className, className)}>
      {s.label}
    </span>
  );
};
