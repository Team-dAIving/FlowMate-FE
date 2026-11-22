import React from 'react';
import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { Task } from '../../types';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';

export interface TaskTimelineViewProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
}

const DAYS = 16;
const DAYS_BEFORE_TODAY = 4;
const GRID = { gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` };

const toDay = (s?: string) => {
  if (!s) return undefined;
  const d = parseISO(s);
  return isValid(d) ? startOfDay(d) : undefined;
};

export const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({ tasks, onSelectTask }) => {
  // A 16-day window around today, computed from real dates (month boundaries included)
  const today = startOfDay(new Date());
  const windowStart = addDays(today, -DAYS_BEFORE_TODAY);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(windowStart, i));
  const col = (d: Date) => differenceInCalendarDays(d, windowStart);

  return (
    <div className="border border-border rounded-lg bg-surface overflow-x-auto shadow-subtle">
      {/* Header Days */}
      <div className="flex border-b border-border/80 min-w-[900px] bg-surface-hover/60">
        <div className="w-64 p-3 text-xs font-mono font-semibold text-text-muted shrink-0 border-r border-border/60">
          TASK / SCHEDULE
        </div>
        <div className="flex-1 grid divide-x divide-border/40" style={GRID}>
          {days.map((d, i) => {
            const isToday = i === DAYS_BEFORE_TODAY;
            return (
              <div
                key={d.toISOString()}
                className={`py-2 text-center font-mono text-[11px] ${
                  isToday ? 'bg-primary/10 text-primary font-bold' : 'text-text-muted'
                }`}
              >
                {format(d, 'MM.dd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40 min-w-[900px]">
        {tasks.length === 0 && <div className="p-8 text-center text-xs text-text-muted">표시할 업무가 없습니다.</div>}
        {tasks.map((task) => {
          // Only start or only due: treat it as a one-day item on that date
          let start = toDay(task.startDate) ?? toDay(task.dueDate);
          let end = toDay(task.dueDate) ?? start;
          if (start && end && end < start) [start, end] = [end, start];
          const startIdx = start ? col(start) : undefined;
          const endIdx = end ? col(end) : undefined;
          const inView = startIdx !== undefined && endIdx !== undefined && endIdx >= 0 && startIdx < DAYS;
          const startCol = inView ? Math.max(0, startIdx!) : 0;
          const span = inView ? Math.min(DAYS - 1, endIdx!) - startCol + 1 : 0;

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className="flex items-center hover:bg-surface-hover/50 cursor-pointer transition-colors h-11"
            >
              {/* Task name col */}
              <div className="w-64 px-3 flex items-center justify-between gap-2 shrink-0 border-r border-border/60 truncate">
                <span className="text-xs font-medium text-text-primary truncate">{task.title}</span>
                {task.assignee && <Avatar src={task.assignee.avatarUrl} name={task.assignee.name} size="xs" />}
              </div>

              {/* Bar track: same grid as the header so bars line up with the dates */}
              <div className="flex-1 relative h-full grid items-center" style={GRID}>
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/40 z-10 pointer-events-none"
                  style={{ left: `${((DAYS_BEFORE_TODAY + 0.5) / DAYS) * 100}%` }}
                />
                {inView ? (
                  <div
                    className="h-6 mx-0.5 rounded bg-primary/20 border border-primary/50 px-2 flex items-center justify-between text-[10px] font-mono font-medium text-primary shadow-sm transition-all hover:bg-primary/30 min-w-0"
                    style={{ gridColumn: `${startCol + 1} / span ${span}` }}
                    title={`${formatDate(task.startDate)} ~ ${formatDate(task.dueDate)}`}
                  >
                    <span className="truncate">{task.title}</span>
                    <Badge status={task.status} className="scale-75 origin-right" />
                  </div>
                ) : (
                  <span className="col-span-full px-3 text-[10px] text-text-muted">
                    {start ? `표시 범위 밖 (${formatDate(task.startDate || task.dueDate, 'MM.dd')} ~ ${formatDate(task.dueDate || task.startDate, 'MM.dd')})` : '일정 없음'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
