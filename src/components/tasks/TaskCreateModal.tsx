import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useTaskStore } from '../../store/useTaskStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getMyProjects, getProjectMemberUsers } from '../../utils/projectMembers';
import { TaskPriority } from '../../types';

export interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ isOpen, onClose }) => {
  const { createTask } = useTaskStore();
  const { projects, currentProjectId, currentUser } = useWorkspaceStore();

  const [projectId, setProjectId] = useState(currentProjectId || projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState(currentUser?.id || '');

  // 내가 속한 프로젝트만 선택 가능, 담당자는 선택된 프로젝트의 멤버로 한정
  const myProjects = getMyProjects(projects, currentUser);
  const projectMembers = getProjectMemberUsers(myProjects.find((p) => p.id === projectId), currentUser);

  // Modal stays mounted — re-sync defaults on every open (currentProjectId may have changed)
  useEffect(() => {
    if (!isOpen) return;
    const mine = getMyProjects(projects, currentUser);
    const initial = mine.find((p) => p.id === currentProjectId) ? currentProjectId! : mine[0]?.id || '';
    setProjectId(initial);
    setAssigneeId(currentUser?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // If the selected assignee isn't in the newly selected project, fall back to a valid member
  useEffect(() => {
    if (!projectMembers.some((m) => m.id === assigneeId)) {
      setAssigneeId(projectMembers.find((m) => m.id === currentUser?.id)?.id || projectMembers[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectMembers.map((m) => m.id).join(',')]);
  const [dueDate, setDueDate] = useState('2026-11-25');
  const [estimatedHours, setEstimatedHours] = useState('8');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const assignee = (projectMembers.find((m) => m.id === assigneeId) || currentUser) ?? undefined;
      await createTask({
        projectId: projectId || myProjects[0]?.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        assignee,
        dueDate,
        estimatedHours: Number(estimatedHours) || 8,
      });
      setTitle('');
      setDescription('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title="새 업무 등록 (Create Task)"
      description="프로젝트에 속하는 신규 이슈를 생성하고 담당자와 마감일을 지정합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Project select */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            프로젝트
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-surface px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {myProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <Input
          label="업무 제목 (Title)"
          placeholder="예: Amazon Transcribe STT 파이프라인 연동"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Description */}
        <Textarea
          label="상세 설명 (Description)"
          placeholder="구현할 내용, 목표, 참고 문서 등을 작성하세요."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {/* Priority & Assignee Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              우선순위 (Priority)
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-8 rounded-md border border-border bg-surface px-3 text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              담당자 (Assignee)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-surface px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {projectMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.department ? ` (${m.department})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Due date & Estimated hours */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label="마감일 (Due Date)"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Input
            type="number"
            label="예상 소요 시간 (Hours)"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading}>
            업무 등록
          </Button>
        </div>
      </form>
    </Modal>
  );
};
