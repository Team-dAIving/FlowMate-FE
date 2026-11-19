import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { teamMembers } from '../../services/mockData';
import { ProjectType } from '../../types';

export interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose }) => {
  const { createProject, currentWorkspace } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('2026-11-18');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [projectType, setProjectType] = useState<ProjectType>('WEB');
  const [techStackInput, setTechStackInput] = useState('React, TypeScript, Spring Boot');
  const [repoName, setRepoName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const techStack = techStackInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const generatedKey = key.trim().toUpperCase() || name.slice(0, 3).toUpperCase();

      await createProject({
        workspaceId: currentWorkspace?.id || 'ws-flowmate',
        name: name.trim(),
        key: generatedKey,
        description: description.trim(),
        goal: goal.trim(),
        startDate,
        endDate,
        projectType,
        techStack,
        members: teamMembers.map((u) => ({ user: u, role: u.role })),
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
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="프로젝트명"
              placeholder="예: FlowMate Platform"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) {
                  setKey(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase());
                }
              }}
              required
            />
          </div>
          <div>
            <Input
              label="식별 키 (Key)"
              placeholder="예: FM"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              required
            />
          </div>
        </div>

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
