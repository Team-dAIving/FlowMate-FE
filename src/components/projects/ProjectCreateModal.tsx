import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTeamStore } from '../../store/useTeamStore';
import { ProjectType, User } from '../../types';
import { api } from '../../services/api';

export interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTeamId?: string; // 팀 상세에서 열 때 자동 선택
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose, defaultTeamId }) => {
  const { createProject, currentWorkspace, currentUser } = useWorkspaceStore();
  const { teams, fetchTeams } = useTeamStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('2026-11-18');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [projectType, setProjectType] = useState<ProjectType>('WEB');
  const [techStackInput, setTechStackInput] = useState('React, TypeScript, Spring Boot');
  const [repoName, setRepoName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId || '');
  const [leaderId, setLeaderId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // The modal stays mounted, so useState(defaultTeamId) only runs once — re-sync on every open
  useEffect(() => {
    if (isOpen) {
      setSelectedTeamId(defaultTeamId || '');
      setLeaderId('');
    }
  }, [isOpen, defaultTeamId]);

  // Everyone who will be a project member, and therefore a leader candidate
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  // Team responses only carry { id, name, avatarUrl } — prefer the full currentUser object for self
  const candidateUsers: User[] = selectedTeam
    ? selectedTeam.members.map((m) =>
        m.id === currentUser?.id
          ? currentUser
          : { id: m.id, name: m.name, avatarUrl: m.avatarUrl, email: '', role: 'MEMBER' as const }
      )
    : currentUser
    ? [currentUser]
    : [];
  // Default to the creator; fall back to the first member if the chosen leader is no longer a candidate
  const effectiveLeaderId = candidateUsers.some((u) => u.id === leaderId)
    ? leaderId
    : candidateUsers.some((u) => u.id === currentUser?.id)
    ? currentUser!.id
    : candidateUsers[0]?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const techStack = techStackInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const newProject = await createProject({
        workspaceId: currentWorkspace?.id || 'ws-flowmate',
        name: name.trim(),
        description: description.trim(),
        goal: goal.trim(),
        startDate,
        endDate,
        projectType,
        techStack,
        // 팀 선택 시 해당 팀원만, 아니면 본인만 — 전체 유저를 프로젝트에 넣지 않음.
        // 리더는 팀이 아니라 프로젝트 단위로 지정 (leaderId + OWNER 역할)
        leaderId: effectiveLeaderId || undefined,
        members: candidateUsers.map((u) => ({
          user: u,
          role: u.id === effectiveLeaderId ? ('OWNER' as const) : ('MEMBER' as const),
        })),
        githubRepo: repoName.trim()
          ? {
              id: Date.now(),
              name: repoName.trim(),
              fullName: `dAIving/${repoName.trim()}`,
              htmlUrl: `https://github.com/dAIving/${repoName.trim()}`,
              isPrivate: true,
              defaultBranch: 'main',
            }
          : undefined,
      });

      // If a team was selected, link this project to that team
      if (selectedTeamId) {
        await api.linkProjectToTeam(selectedTeamId, newProject.id);
        await fetchTeams(); // Refresh teams store
      }

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
      title="새 프로젝트 생성 (Create Project)"
      description="개발팀의 프로젝트 주제, 목표, 기술 스택 및 저장소를 구성합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="프로젝트명"
          placeholder="예: FlowMate Platform"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="프로젝트 설명 (Description)"
          placeholder="프로젝트 목적 및 개요를 입력하세요."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Input
          label="프로젝트 최종 목표 (Goal)"
          placeholder="예: MVP 릴리즈 및 개발팀 정식 론칭"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              프로젝트 유형
            </label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="WEB">Web</option>
              <option value="APP">App</option>
              <option value="AI">AI / ML</option>
              <option value="EMBEDDED">Embedded</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <Input
            type="date"
            label="시작일"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            type="date"
            label="종료 예정일"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <Input
          label="기술 스택 (쉼표로 구분)"
          placeholder="React, TypeScript, Spring Boot, PostgreSQL, Bedrock"
          value={techStackInput}
          onChange={(e) => setTechStackInput(e.target.value)}
        />

        {/* Team selection */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            소속 팀 (Team) — 선택
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">팀 없이 생성</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-text-muted">
            선택 시 해당 팀의 프로젝트로 자동 연결됩니다.
          </p>
        </div>

        {/* Project leader */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            프로젝트 리더 (Leader)
          </label>
          <select
            value={effectiveLeaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {candidateUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.id === currentUser?.id ? ' (나)' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-text-muted">
            리더는 프로젝트마다 지정합니다. 소속 팀을 고르면 그 팀원 중에서 선택할 수 있습니다.
          </p>
        </div>

        <Input
          label="연결할 GitHub Repository (선택)"
          placeholder="예: FlowMate-Core"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading}>
            프로젝트 생성
          </Button>
        </div>
      </form>
    </Modal>
  );
};

