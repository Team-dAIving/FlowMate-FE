import React from 'react';
import { Plus, MoreHorizontal, GitBranch, MessageSquare, AlertCircle } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';
import { isOverdue as isTaskOverdue } from '../../utils/dates';
import { isFeatureAvailable } from '../../services/features';
import { STATUS_META, TASK_STATUSES } from '../../utils/taskStatus';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';

export interface TaskKanbanViewProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
}

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = TASK_STATUSES.map((id) => ({
  id,
  label: STATUS_META[id].label,
  dot: STATUS_META[id].dot,
}));

export const TaskKanbanView: React.FC<TaskKanbanViewProps> = ({ tasks, onSelectTask }) => {
  const { updateTaskStatus } = useTaskStore();
  const { setCreateTaskModalOpen } = useUIStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Moving cards changes the task status: only where the backend can store it
  const canMove = isFeatureAvailable('taskWrite');

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && canMove) {
      updateTaskStatus(taskId, status).catch((err) => console.error('Failed to move task:', err));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className="bg-surface/50 border border-border/80 rounded-lg flex flex-col max-h-[calc(100vh-170px)]"
          >
            {/* Column Header */}
            <div className="p-3 border-b border-border/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-mono font-bold text-text-primary tracking-tight">
                  {col.label}
                </span>
                <span className="text-[10px] font-mono text-text-muted bg-surface border border-border px-1.5 py-px rounded-full">
                  {colTasks.length}
                </span>
              </div>

              <button
                onClick={() => setCreateTaskModalOpen(true)}
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-hover"
                title="새 업무 추가" aria-label="새 업무 추가"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Column Cards */}
            <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
              {colTasks.length === 0 ? (
                <div className="py-8 text-center text-[11px] text-text-muted border border-dashed border-border/60 rounded-md">
                  업무 없음
                </div>
              ) : (
                colTasks.map((task) => {
                  const overdue = isTaskOverdue(task);

                  return (
                    <div
                      key={task.id}
                      draggable={canMove}
                      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                      onClick={() => onSelectTask(task.id)}
                      className="p-3 bg-surface border border-border rounded-lg shadow-subtle hover:border-primary/50 hover:shadow-card cursor-pointer transition-all space-y-2 group"
                    >
                      {/* Top: priority */}
                      <div className="flex items-center justify-between">
                        <Badge priority={task.priority} />
                      </div>

                      {/* Title */}
                      <h5 className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">
                        {task.title}
                      </h5>

                      {/* Footer Info: GitHub, Comments, Due Date, Assignee */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                        <div className="flex items-center gap-1.5 text-text-muted">
                          {task.githubIssue && (
                            <span
                              className="font-mono text-[10px] flex items-center gap-0.5 bg-surface-hover px-1 rounded border border-border"
                              title={`GitHub #${task.githubIssue.number}`}
                            >
                              <GitBranch className="h-2.5 w-2.5" />
                              #{task.githubIssue.number}
                            </span>
                          )}

                          {task.comments.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                              <MessageSquare className="h-2.5 w-2.5" />
                              {task.comments.length}
                            </span>
                          )}

                          {task.dueDate && (
                            <span
                              className={`font-mono text-[10px] ${
                                overdue ? 'text-red-500 font-semibold flex items-center gap-0.5' : ''
                              }`}
                            >
                              {overdue && <AlertCircle className="h-2.5 w-2.5" />}
                              {formatDate(task.dueDate, 'MM.dd')}
                            </span>
                          )}
                        </div>

                        {task.assignee && (
                          <Avatar
                            src={task.assignee.avatarUrl}
                            name={task.assignee.name}
                            size="xs"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
