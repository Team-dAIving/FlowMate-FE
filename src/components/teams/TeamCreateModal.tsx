import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useTeamStore } from '../../store/useTeamStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { teamMembers } from '../../services/mockData';
import { Avatar } from '../ui/Avatar';

export interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamCreateModal: React.FC<TeamCreateModalProps> = ({ isOpen, onClose }) => {
  const { createTeam } = useTeamStore();
  const { projects, currentWorkspace } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leadId, setLeadId] = useState(teamMembers[0]?.id || '');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([teamMembers[0]?.id || '']);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    projects[0]?.id ? [projects[0].id] : []
  );
  const [color, setColor] = useState('#4F46E5');
  const [isLoading, setIsLoading] = useState(false);

  const toggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((m) => m !== id));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const toggleProject = (id: string) => {
    if (selectedProjectIds.includes(id)) {
      setSelectedProjectIds(selectedProjectIds.filter((p) => p !== id));
    } else {
      setSelectedProjectIds([...selectedProjectIds, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await createTeam({
        workspaceId: currentWorkspace?.id || 'ws-flowmate',
        name: name.trim(),
        description: description.trim(),
        leadId,
        memberIds: selectedMemberIds,
        projectIds: selectedProjectIds,
        color,
      });

      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const COLOR_OPTIONS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#2563EB', '#DB2777'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title="새 팀 생성 (Create Team)"
      description="개발팀의 역할과 전문 분야에 맞는 팀을 생성하고 참여할 프로젝트와 팀원을 배정합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Team Name */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <Input
              label="팀 이름 (Team Name)"
              placeholder="예: Core Frontend Team, AI Research Squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              테마 색상
            </label>
            <div className="flex items-center gap-1.5 pt-1">
              {COLOR_OPTIONS.slice(0, 4).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    color === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <Textarea
          label="팀 역할 및 주요 업무 분야 (Responsibilities)"
          placeholder="예: React/Electron 기반 클라이언트 런타임 및 개발자 UI/UX 컴포넌트 개발"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          required
        />

        {/* Team Lead */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            팀 리더 (Team Lead)
          </label>
          <select
            value={leadId}
            onChange={(e) => {
              setLeadId(e.target.value);
              if (!selectedMemberIds.includes(e.target.value)) {
                setSelectedMemberIds([...selectedMemberIds, e.target.value]);
              }
            }}
            className="w-full h-8 rounded-md border border-border bg-surface px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.department || m.role})
              </option>
            ))}
          </select>
        </div>

        {/* Members multi-select */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            소속 팀원 선택 ({selectedMemberIds.length}명 선택됨)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg border border-border bg-surface-hover/30 max-h-36 overflow-y-auto">
            {teamMembers.map((user) => {
              const isSelected = selectedMemberIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleMember(user.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary-light/50 text-text-primary font-medium'
                      : 'border-border/60 bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Avatar src={user.avatarUrl} name={user.name} size="xs" />
                  <span className="truncate">{user.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Connected Projects */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            담당 / 연결할 프로젝트 (어디 업무를 맡을지 선택)
          </label>
          <div className="space-y-1.5 p-2.5 rounded-lg border border-border bg-surface-hover/30 max-h-32 overflow-y-auto">
            {projects.map((proj) => {
              const isSelected = selectedProjectIds.includes(proj.id);
              return (
                <div
                  key={proj.id}
                  onClick={() => toggleProject(proj.id)}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary-light/40 text-text-primary font-medium'
                      : 'border-border/60 bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-1 py-0.2 rounded bg-surface border border-border">
                      {proj.key}
                    </span>
                    <span className="truncate">{proj.name}</span>
                  </div>
                  <span className="text-[10px] text-text-muted">{proj.projectType}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading}>
            팀 생성
          </Button>
        </div>
      </form>
    </Modal>
  );
};
