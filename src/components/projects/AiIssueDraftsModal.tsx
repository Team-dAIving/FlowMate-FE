import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Github, Loader2, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NotConnected } from '../ui/NotConnected';
import { IssueDraft, Project, TaskPriority } from '../../types';
import { api } from '../../services/api';
import { isFeatureAvailable } from '../../services/features';
import { useTaskStore } from '../../store/useTaskStore';
import { repoForPosition } from '../../utils/github';

export interface AiIssueDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'URGENT', label: '긴급' },
  { id: 'HIGH', label: '높음' },
  { id: 'MEDIUM', label: '보통' },
  { id: 'LOW', label: '낮음' },
];

type Phase = 'generating' | 'review' | 'error' | 'saving';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/**
 * AI 이슈 자동 생성:
 * 1) project info (design text, members' parts and stacks, period) goes to the AI
 * 2) the AI returns task drafts
 * 3) the user edits them: add/remove, assignee, dates, priority, whether to open a GitHub issue
 * 4) confirm: tasks are registered in FlowMate, and GitHub issues are opened for the marked ones
 */
export const AiIssueDraftsModal: React.FC<AiIssueDraftsModalProps> = ({ isOpen, onClose, project }) => {
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const [phase, setPhase] = useState<Phase>('generating');
  const [drafts, setDrafts] = useState<IssueDraft[]>([]);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const seq = useRef(0);
  // The store hands out a new project object on every refetch: read the latest one, but only regenerate on open
  const projectRef = useRef(project);
  projectRef.current = project;

  const canRegister = isFeatureAvailable('taskWrite');
  const hasRepos = (project.repositories || []).length > 0;
  // A GitHub issue needs a repo for the assignee's part (or a common/first repo)
  const issueRepoFor = (assigneeId?: string) =>
    repoForPosition(project, project.members.find((m) => m.user.id === assigneeId)?.position);

  const generate = useCallback(async () => {
    const mine = ++seq.current;
    setPhase('generating');
    setError('');
    setSaveError('');
    try {
      const list = await api.generateIssueDrafts(projectRef.current);
      if (mine !== seq.current) return;
      const repoCount = (projectRef.current.repositories || []).length;
      setDrafts(list.map((d) => ({ ...d, createGithubIssue: d.createGithubIssue && repoCount > 0 })));
      setPhase('review');
    } catch (err) {
      if (mine !== seq.current) return;
      console.error('AI issue drafts failed:', err);
      setError(errorText(err, 'AI 업무 초안을 만들지 못했습니다.'));
      setPhase('error');
    }
  }, []);

  // Generate on open; closing cancels a pending result
  useEffect(() => {
    if (isOpen) void generate();
    else seq.current += 1;
  }, [isOpen, project.id, generate]);

  const update = (key: string, patch: Partial<IssueDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const addBlank = () =>
    setDrafts((prev) => [
      ...prev,
      {
        key: `draft-new-${Date.now()}`,
        title: '',
        description: '',
        priority: 'MEDIUM',
        startDate: prev[prev.length - 1]?.startDate || '',
        dueDate: prev[prev.length - 1]?.dueDate || '',
        labels: [],
        createGithubIssue: false,
      },
    ]);

  const issueCount = drafts.filter((d) => d.createGithubIssue).length;

  const confirm = async () => {
    if (phase === 'saving') return;
    const empty = drafts.find((d) => !d.title.trim());
    if (empty) return setSaveError('제목이 비어 있는 업무가 있습니다.');
    const badDates = drafts.find((d) => d.startDate && d.dueDate && d.dueDate < d.startDate);
    if (badDates) return setSaveError(`"${badDates.title}"의 마감일이 시작일보다 빠릅니다.`);
    setPhase('saving');
    setSaveError('');
    try {
      const r = await api.registerIssueDrafts(project, drafts);
      await fetchTasks();
      onClose();
      if (r.issuesFailed > 0) {
        window.alert(`업무 ${r.created}개를 등록했습니다. GitHub 이슈 ${r.issuesFailed}개는 만들지 못했습니다.`);
      }
    } catch (err) {
      console.error(err);
      setSaveError(errorText(err, '업무를 등록하지 못했습니다.'));
      setPhase('review');
    }
  };

  const inputClass =
    'h-7 rounded-md border border-border bg-surface px-2 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title="AI 이슈 자동 생성"
      description="설계서와 팀원 구성을 바탕으로 AI가 업무 초안을 만듭니다. 확인하고 고친 뒤 등록하세요."
    >
      {phase === 'generating' && (
        <div className="py-12 flex flex-col items-center gap-2 text-xs text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          AI가 업무를 나누는 중입니다. 설계서 길이에 따라 1분 정도 걸릴 수 있습니다.
        </div>
      )}

      {phase === 'error' && (
        <div className="py-8 flex flex-col items-center gap-3">
          <p role="alert" className="text-xs text-red-500 text-center">
            {error}
          </p>
          <Button size="sm" variant="outline" onClick={() => void generate()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            다시 시도
          </Button>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <div className="space-y-3">
          {!canRegister && <NotConnected feature="업무 일괄 등록·GitHub 이슈 생성" />}

          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>
              업무 {drafts.length}개 · GitHub 이슈로 만들 업무 {issueCount}개
            </span>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={phase === 'saving'}
              className="flex items-center gap-1 hover:text-text-primary disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              다시 생성
            </button>
          </div>

          {drafts.length === 0 && (
            <p className="py-6 text-center text-xs text-text-muted">AI가 만든 업무가 없습니다. 직접 추가하거나 다시 생성해보세요.</p>
          )}

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {drafts.map((d) => {
              const repo = issueRepoFor(d.assigneeId);
              return (
                <div key={d.key} className="p-3 rounded-lg border border-border bg-surface-hover/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={d.title}
                      onChange={(e) => update(d.key, { title: e.target.value })}
                      maxLength={200}
                      placeholder="업무 제목"
                      aria-label="업무 제목"
                      className={`${inputClass} flex-1 min-w-0 text-xs font-semibold`}
                    />
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                      aria-label={`${d.title || '업무'} 삭제`}
                      title="이 업무 빼기"
                      className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={d.description}
                    onChange={(e) => update(d.key, { description: e.target.value })}
                    rows={2}
                    maxLength={5000}
                    placeholder="설명"
                    aria-label="업무 설명"
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={d.assigneeId || ''}
                      onChange={(e) => {
                        const assigneeId = e.target.value || undefined;
                        update(d.key, {
                          assigneeId,
                          // no repo for the new assignee's part: can't open an issue
                          createGithubIssue: d.createGithubIssue && Boolean(issueRepoFor(assigneeId)),
                        });
                      }}
                      aria-label="담당자"
                      className={inputClass}
                    >
                      <option value="">담당자 없음</option>
                      {project.members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={d.priority}
                      onChange={(e) => update(d.key, { priority: e.target.value as TaskPriority })}
                      aria-label="우선순위"
                      className={inputClass}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-text-muted">
                      시작
                      <input
                        type="date"
                        value={d.startDate}
                        onChange={(e) => update(d.key, { startDate: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-text-muted">
                      마감
                      <input
                        type="date"
                        value={d.dueDate}
                        min={d.startDate || undefined}
                        onChange={(e) => update(d.key, { dueDate: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                    {d.estimatedHours != null && (
                      <span className="text-[11px] text-text-muted">예상 {d.estimatedHours}시간</span>
                    )}
                    <label
                      className="ml-auto flex items-center gap-1 text-[11px] text-text-secondary"
                      title={repo ? `${repo.fullName}에 이슈를 만듭니다` : '이 담당자의 파트에 연결된 레포가 없습니다'}
                    >
                      <input
                        type="checkbox"
                        checked={d.createGithubIssue}
                        disabled={!repo}
                        onChange={(e) => update(d.key, { createGithubIssue: e.target.checked })}
                      />
                      <Github className="h-3 w-3" />
                      GitHub 이슈
                    </label>
                  </div>
                  {d.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.labels.map((l) => (
                        <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addBlank}
            disabled={phase === 'saving'}
            className="w-full h-8 rounded-md border border-dashed border-border text-[11px] text-text-secondary hover:bg-surface-hover flex items-center justify-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            업무 직접 추가
          </button>

          {!hasRepos && (
            <p className="text-[11px] text-text-muted">이 프로젝트에 연결된 GitHub 레포가 없어 GitHub 이슈는 만들 수 없습니다.</p>
          )}
          {saveError && (
            <p role="alert" className="text-[11px] text-red-500">
              {saveError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirm()}
              isLoading={phase === 'saving'}
              disabled={!canRegister || drafts.length === 0}
            >
              {drafts.length}개 업무 등록
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
