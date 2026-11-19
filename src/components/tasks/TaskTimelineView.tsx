import React from 'react';
import { Task } from '../../types';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';

export interface TaskTimelineViewProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
}

export const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({ tasks, onSelectTask }) => {
  // Timeline dates: 2026-11-10 to 2026-11-25 (16 days range)
  const days = Array.from({ length: 16 }, (_, i) => {
    const dayNum = 10 + i;
    return `2026-11-${dayNum.toString().padStart(2, '0')}`;
  });

  return (
    <div className="border border-border rounded-lg bg-surface overflow-x-auto shadow-subtle">
      {/* Header Days */}
      <div className="flex border-b border-border/80 min-w-[900px] bg-surface-hover/60">
        <div className="w-64 p-3 text-xs font-mono font-semibold text-text-muted shrink-0 border-r border-border/60">
          TASK / SCHEDULE
        </div>
        <div className="flex-1 grid grid-cols-16 divide-x divide-border/40">
          {days.map((d) => {
            const isToday = d === '2026-11-18';
            return (
              <div
                key={d}
                className={`py-2 text-center font-mono text-[11px] shrink-0 ${
                  isToday ? 'bg-primary/10 text-primary font-bold' : 'text-text-muted'
                }`}
              >
                {d.slice(5)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40 min-w-[900px]">
        {tasks.map((task) => {
          // Calculate start & due offsets relative to 2026-11-10
          const startDay = task.startDate ? parseInt(task.startDate.slice(8)) : 12;
          const dueDay = task.dueDate ? parseInt(task.dueDate.slice(8)) : startDay + 4;

          const startCol = Math.max(0, Math.min(15, startDay - 10));
          const span = Math.max(1, Math.min(16 - startCol, dueDay - startDay + 1));

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className="flex items-center hover:bg-surface-hover/50 cursor-pointer transition-colors h-11"
            >
              {/* Task name col */}
              <div className="w-64 px-3 flex items-center justify-between gap-2 shrink-0 border-r border-border/60 truncate">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-[10px] font-bold text-text-muted">
                    {task.issueKey}
                  </span>
                  <span className="text-xs font-medium text-text-primary truncate">
                    {task.title}
                  </span>
                </div>
                {task.assignee && (
                  <Avatar src={task.assignee.avatarUrl} name={task.assignee.name} size="xs" />
                )}
              </div>

              {/* Bar track */}
              <div className="flex-1 relative h-full flex items-center px-2">
                {/* Today vertical line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/40 z-10 pointer-events-none"
                  style={{ left: `${(8 / 16) * 100}%` }}
                />

                {/* Task Duration Bar */}
                <div
                  className="h-6 rounded bg-primary/20 border border-primary/50 px-2 flex items-center justify-between text-[10px] font-mono font-medium text-primary shadow-xs transition-all hover:bg-primary/30"
                  style={{
                    marginLeft: `${(startCol / 16) * 100}%`,
                    width: `${(span / 16) * 100}%`,
                  }}
                >
                  <span className="truncate">{task.title}</span>
                  <Badge status={task.status} className="scale-75 origin-right" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
