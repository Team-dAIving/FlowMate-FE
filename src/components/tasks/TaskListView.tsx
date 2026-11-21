import React from 'react';
import { GitBranch, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { Task } from '../../types';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';

export interface TaskListViewProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({ tasks, onSelectTask }) => {
  if (tasks.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-lg bg-surface/50">
        <p className="text-xs text-text-muted">조건에 맞는 업무가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle">
      {/* Table Header */}
      <div className="px-3.5 py-2 bg-surface-hover/50 text-[11px] font-mono font-semibold text-text-muted flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <span className="w-20 shrink-0">PRIORITY</span>
          <span className="flex-1">TITLE</span>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-right">
          <span className="w-24 text-center">STATUS</span>
          <span className="w-28 text-center">ASSIGNEE</span>
          <span className="w-20 text-center">DUE DATE</span>
        </div>
      </div>

      {/* Rows */}
      {tasks.map((task) => {
        const isOverdue =
          task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < new Date('2026-11-18');

        return (
          <div
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className="px-3.5 py-2.5 flex items-center justify-between gap-4 hover:bg-surface-hover cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">

              <div className="w-20 shrink-0">
                <Badge priority={task.priority} />
              </div>

              <div className="flex items-center gap-2 truncate flex-1">
                <span className="text-xs font-medium text-text-primary truncate">
                  {task.title}
                </span>

                {task.githubIssue && (
                  <span
                    className="text-[10px] font-mono text-text-muted flex items-center gap-1 bg-surface-hover px-1.5 py-0.2 rounded border border-border shrink-0"
                    title={`GitHub Issue #${task.githubIssue.number}`}
                  >
                    <GitBranch className="h-2.5 w-2.5" />
                    #{task.githubIssue.number}
                  </span>
                )}

                {task.comments.length > 0 && (
                  <span className="text-[10px] text-text-muted flex items-center gap-0.5 shrink-0">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {task.comments.length}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 shrink-0">
              <div className="w-24 flex justify-center">
                <Badge status={task.status} />
              </div>

              <div className="w-28 flex items-center justify-center gap-1.5">
                {task.assignee ? (
                  <>
                    <Avatar src={task.assignee.avatarUrl} name={task.assignee.name} size="xs" />
                    <span className="text-xs text-text-secondary truncate">{task.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-xs text-text-muted italic">미지정</span>
                )}
              </div>

              <div className="w-20 text-center font-mono text-xs text-text-secondary">
                {task.dueDate ? (
                  <span className={isOverdue ? 'text-red-500 font-semibold flex items-center justify-center gap-1' : ''}>
                    {isOverdue && <AlertCircle className="h-3 w-3" />}
                    {formatDate(task.dueDate, 'MM.dd')}
                  </span>
                ) : (
                  <span className="text-text-muted">-</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
