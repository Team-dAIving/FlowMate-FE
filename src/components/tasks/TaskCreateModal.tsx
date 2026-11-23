import React, { useEffect, useState } from 'react';
import { Github, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useTaskStore } from '../../store/useTaskStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getMyProjects, getProjectMemberUsers } from '../../utils/projectMembers';
import { ProjectRepository, TaskPriority } from '../../types';
import { daysFromTodayISO, todayISO } from '../../utils/dates';
import { isFeatureAvailable } from '../../services/features';
import { api } from '../../services/api';
import { repoForPosition, repoRoleLabel } from '../../utils/github';

export interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// What the server needs to identify a repo (githubRepositoryId); mock repos only have an id
const repoKey = (r: ProjectRepository) => r.githubRepositoryId ?? r.id;

type RepoState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; repos: ProjectRepository[] };

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ isOpen, onClose }) => {
  const { fetchTasks } = useTaskStore();
  const { projects, currentProjectId, currentUser } = useWorkspaceStore();

  const [projectId, setProjectId] = useState(currentProjectId || projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState(currentUser?.id || '');
  const [dueDate, setDueDate] = useState(() => daysFromTodayISO(7));
  const [estimatedHours, setEstimatedHours] = useState('8');
  const [createIssue, setCreateIssue] = useState(false);
  const [repoChoice, setRepoChoice] = useState(''); // repoKey; '' until picked or suggested
  const [repoTouched, setRepoTouched] = useState(false); // picked by hand: stop following the assignee
  const [repoState, setRepoState] = useState<RepoState>({ status: 'loading' });
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 내가 속한 프로젝트만 선택 가능, 담당자는 선택된 프로젝트의 멤버로 한정
  const myProjects = getMyProjects(projects, currentUser);
  const project = myProjects.find((p) => p.id === projectId);
  const projectMembers = getProjectMemberUsers(project, currentUser);

  // Modal stays mounted — re-sync defaults on every open (currentProjectId may have changed)
  useEffect(() => {
    if (!isOpen) return;
    const mine = getMyProjects(projects, currentUser);
    const initial = mine.find((p) => p.id === currentProjectId) ? currentProjectId! : mine[0]?.id || '';
    setProjectId(initial);
    setAssigneeId(currentUser?.id || '');
    // Reset the rest too, so the previous task's values never carry over
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setDueDate(daysFromTodayISO(7));
    setEstimatedHours('8');
    setCreateIssue(false);
    setRepoChoice('');
    setRepoTouched(false);
    setSubmitError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // If the selected assignee isn't in the newly selected project, fall back to a valid member
  useEffect(() => {
    if (!projectMembers.some((m) => m.id === assigneeId)) {
      setAssigneeId(projectMembers.find((m) => m.id === currentUser?.id)?.id || projectMembers[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectMembers.map((m) => m.id).join(',')]);

  // The project's connected repos, for "which repo gets the GitHub issue"
  useEffect(() => {
    if (!isOpen || !project) return;
    let alive = true;
    setRepoState({ status: 'loading' });
    setRepoChoice('');
    setRepoTouched(false);
    api
      .getProjectRepositories(project)
      .then((repos) => alive && setRepoState({ status: 'ready', repos }))
      .catch((err) => {
        console.error('Failed to load project repositories:', err);
        if (alive) setRepoState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const repos = repoState.status === 'ready' ? repoState.repos : [];
  // Suggest the repo of the assignee's part (else the common one), until the user picks one
  const assigneePosition = project?.members.find((m) => m.user.id === assigneeId)?.position;
  const suggested = project ? repoForPosition({ ...project, repositories: repos }, assigneePosition) : undefined;
  useEffect(() => {
    if (!repoTouched) setRepoChoice(suggested ? repoKey(suggested) : '');
  }, [repoTouched, suggested ? repoKey(suggested) : '']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!title.trim()) return setSubmitError('업무 제목을 입력해주세요.');
    if (!project) return setSubmitError('업무를 등록할 프로젝트를 선택해주세요.');
    if (!dueDate) return setSubmitError('마감일을 입력해주세요.');
    // The server starts the task today (Seoul time), so the due date can't be earlier
    if (dueDate < todayISO()) return setSubmitError('마감일은 오늘 이후여야 합니다.');
    // Empty means "not estimated"
    const hoursText = estimatedHours.trim();
    const hours = hoursText === '' ? undefined : Number(hoursText);
    if (hours !== undefined && (!Number.isFinite(hours) || hours < 0 || hours > 1000))
      return setSubmitError('예상 소요 시간은 0~1000 사이의 숫자로 입력해주세요.');
    if (createIssue && !repoChoice) return setSubmitError('GitHub 이슈를 만들 저장소를 골라주세요.');

    setIsLoading(true);
    setSubmitError('');
    try {
      const result = await api.createManualTask(project, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: projectMembers.some((m) => m.id === assigneeId) ? assigneeId : undefined,
        dueDate,
        estimatedHours: hours,
        createGithubIssue: createIssue,
        githubRepositoryId: createIssue ? repoChoice : undefined,
      });
      await fetchTasks();
      onClose();
      if (result.issueFailed) {
        window.alert(
          `업무는 등록됐지만 GitHub 이슈를 만들지 못했습니다.${result.issueError ? `\n(${result.issueError})` : ''}`
        );
      }
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error && err.message ? err.message : '업무 등록에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isFeatureAvailable('taskCreate')) return null;

  const selectClass =
    'w-full h-8 rounded-md border border-border bg-surface px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50';

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
          <label htmlFor="task-project" className="block text-xs font-medium text-text-secondary mb-1">
            프로젝트
          </label>
          <select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClass}>
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
          maxLength={256}
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
            <label htmlFor="task-priority" className="block text-xs font-medium text-text-secondary mb-1">
              우선순위 (Priority)
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`${selectClass} font-mono`}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div>
            <label htmlFor="task-assignee" className="block text-xs font-medium text-text-secondary mb-1">
              담당자 (Assignee)
            </label>
            <select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={selectClass}>
              {projectMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.department ? ` (${m.department})` : ''}
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
            min={todayISO()}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          <Input
            type="number"
            label="예상 소요 시간 (Hours)"
            min={0}
            max={1000}
            step={0.5}
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>

        {/* GitHub issue: on/off + which repo */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
            <span className="text-xs font-medium text-text-primary flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5" />
              GitHub 이슈도 생성
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={createIssue}
              disabled={repoState.status !== 'ready' || repos.length === 0}
              onChange={(e) => setCreateIssue(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-40"
            />
          </label>

          {repoState.status === 'loading' ? (
            <p className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              연결된 저장소를 불러오는 중…
            </p>
          ) : repoState.status === 'error' ? (
            <p className="text-[11px] text-red-500">연결된 저장소를 불러오지 못했습니다. GitHub 이슈 없이 등록할 수 있습니다.</p>
          ) : repos.length === 0 ? (
            <p className="text-[11px] text-text-muted">이 프로젝트에 연결된 GitHub 저장소가 없어 이슈를 만들 수 없습니다.</p>
          ) : (
            createIssue && (
              <div>
                <label htmlFor="task-repo" className="block text-[11px] font-medium text-text-secondary mb-1">
                  이슈를 만들 저장소
                </label>
                <select
                  id="task-repo"
                  value={repoChoice}
                  onChange={(e) => {
                    setRepoChoice(e.target.value);
                    setRepoTouched(true);
                  }}
                  className={`${selectClass} font-mono`}
                >
                  <option value="">저장소 선택…</option>
                  {repos.map((r) => (
                    <option key={repoKey(r)} value={repoKey(r)}>
                      [{repoRoleLabel(r.role)}] {r.fullName}
                    </option>
                  ))}
                </select>
                {!repoTouched && suggested && (
                  <p className="mt-1 text-[10px] text-text-muted">담당자의 파트에 맞는 저장소를 골라 두었습니다.</p>
                )}
              </div>
            )
          )}
        </div>

        {submitError && (
          <p role="alert" className="text-[11px] text-red-500">
            {submitError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading}>
            {createIssue ? '업무 등록 + 이슈 생성' : '업무 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
