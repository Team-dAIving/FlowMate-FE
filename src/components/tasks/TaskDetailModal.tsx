import React, { useState } from 'react';
import {
  GitBranch,
  Calendar,
  Clock,
  User as UserIcon,
  Send,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '../../types';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { teamMembers } from '../../services/mockData';
import { useTaskStore } from '../../store/useTaskStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatDate, formatTimeAgo } from '../../utils/formatters';

export interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ taskId, onClose }) => {
  const { tasks, updateTask, updateTaskStatus, createGitHubIssue, deleteTask } = useTaskStore();
  const { currentUser } = useWorkspaceStore();
  const [commentInput, setCommentInput] = useState('');
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);

  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const handleStatusChange = (newStatus: TaskStatus) => {
    updateTaskStatus(task.id, newStatus);
  };

  const handlePriorityChange = (newPriority: TaskPriority) => {
    updateTask(task.id, { priority: newPriority });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    const newAssignee = teamMembers.find((m) => m.id === assigneeId);
    if (newAssignee) {
      updateTask(task.id, { assignee: newAssignee });
    }
  };

  const handleAddComment = () => {
    if (!commentInput.trim() || !currentUser) return;
    const newComment = {
      id: `c-${Date.now()}`,
      user: currentUser,
      content: commentInput.trim(),
      createdAt: new Date().toISOString(),
    };
    updateTask(task.id, {
      comments: [...task.comments, newComment],
    });
    setCommentInput('');
  };

  const handleCreateGitHubIssue = async () => {
    setIsSyncingGitHub(true);
    try {
      await createGitHubIssue(task.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('이 업무를 삭제하시겠습니까?')) {
      await deleteTask(task.id);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={!!taskId}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm font-bold text-primary px-1.5 py-0.5 rounded bg-primary-light">
            {task.issueKey}
          </span>
          <span className="text-sm font-semibold truncate text-text-primary">{task.title}</span>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Column (2 cols) */}
        <div className="md:col-span-2 space-y-5">
          {/* Description */}
          <div>
            <div className="text-xs font-semibold text-text-secondary mb-1.5">업무 내용</div>
            <div className="p-3 rounded-lg border border-border bg-surface-hover/30 text-xs text-text-primary leading-relaxed whitespace-pre-line min-h-[80px]">
              {task.description || '등록된 상세 설명이 없습니다.'}
            </div>
          </div>

          {/* GitHub Integration Box (Section 4.8) */}
          <div className="p-3.5 rounded-lg border border-border bg-surface shadow-subtle space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-text-primary">
                  GitHub Repository 연동
                </span>
              </div>
              {task.githubIssue ? (
                <Badge variant="status" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-500" />
                  Issue #{task.githubIssue.number} 연동됨
                </Badge>
              ) : (
                <Badge variant="default" className="text-text-muted">
                  미연동
                </Badge>
              )}
            </div>

            {task.githubIssue ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <a
                  href={task.githubIssue.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>{task.githubIssue.title}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded uppercase">
                  {task.githubIssue.state}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-text-secondary">
                  FlowMate 업무를 단방향으로 GitHub Issue에 등록합니다.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateGitHubIssue}
                  isLoading={isSyncingGitHub}
                  className="text-xs h-7 gap-1"
                >
                  <GitBranch className="h-3 w-3" />
                  <span>GitHub Issue 생성</span>
                </Button>
              </div>
            )}
          </div>

          {/* Comments & Activity Section */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-text-secondary">활동 내역 및 댓글</div>

            {/* Comment list */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto">
              {task.comments.length === 0 ? (
                <div className="text-center py-4 text-xs text-text-muted">작성된 댓글이 없습니다.</div>
              ) : (
                task.comments.map((comment) => (
                  <div key={comment.id} className="p-2.5 rounded border border-border/80 bg-surface text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-text-primary">
                        <Avatar src={comment.user.avatarUrl} name={comment.user.name} size="xs" />
                        <span>{comment.user.name}</span>
                      </div>
                      <span className="text-[10px] text-text-muted">{formatTimeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-text-secondary pl-5">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* New Comment Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="댓글 남기기..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                className="flex-1 h-8 rounded-md border border-border bg-surface px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={handleAddComment} className="h-8">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar Properties (1 col) */}
        <div className="space-y-4 border-l border-border/80 pl-5">
          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase block mb-1">
              Status
            </label>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="DONE">DONE</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase block mb-1">
              Priority
            </label>
            <select
              value={task.priority}
              onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase block mb-1">
              Assignee
            </label>
            <select
              value={task.assignee?.id || ''}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">담당자 선택...</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.department})
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase block mb-1">
              Due Date
            </label>
            <div className="flex items-center gap-1.5 font-mono text-xs text-text-primary p-2 rounded border border-border bg-surface">
              <Calendar className="h-3.5 w-3.5 text-text-muted" />
              <span>{formatDate(task.dueDate)}</span>
            </div>
          </div>

          {/* Hours */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-text-muted uppercase block mb-0.5">
                예상 시간
              </label>
              <div className="font-mono text-xs text-text-primary p-1.5 rounded border border-border bg-surface">
                {task.estimatedHours || 0}h
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-text-muted uppercase block mb-0.5">
                실제 소요
              </label>
              <div className="font-mono text-xs text-text-primary p-1.5 rounded border border-border bg-surface">
                {task.actualHours || 0}h
              </div>
            </div>
          </div>

          {/* Delete Task */}
          <div className="pt-4 border-t border-border/80">
            <button
              onClick={handleDelete}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1.5 w-full justify-center p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>업무 삭제</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
