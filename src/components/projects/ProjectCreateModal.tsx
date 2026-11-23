import React, { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ExternalLink, Github, Loader2, Lock, Plus, RefreshCw, Trash2, UserMinus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { MemberRoleEditor } from './MemberRoleEditor';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTeamStore } from '../../store/useTeamStore';
import {
  GitHubInstallation,
  PROJECT_LIMITS,
  ProjectPosition,
  ProjectRepository,
  ProjectType,
  RepoRole,
  TeamMember,
  User,
} from '../../types';
import { api } from '../../services/api';
import { isFeatureAvailable } from '../../services/features';
import { NotConnected } from '../ui/NotConnected';
import { normalizeSkills } from '../../utils/positions';
import { REPOS_MAX, REPO_ROLES, isGitHubInstallUrl, repoFromInstallation } from '../../utils/github';

export interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTeamId?: string; // 팀 상세에서 열 때 자동 선택
}

export interface DraftMember {
  user: User;
  position?: ProjectPosition;
  skills: string[];
}

/**
 * Project members = me + the selected team's members, minus the ones left out.
 * The backend only accepts members of the project's team, and the creator must be one of them.
 * Roles already entered are kept when the list changes.
 */
export function buildMembers(
  me: User | null,
  teamMembers: TeamMember[],
  excluded: Set<string>,
  roles: Record<string, { position?: ProjectPosition; skills: string[] }>
): DraftMember[] {
  const users: User[] = [];
  if (me) users.push(me);
  for (const tm of teamMembers) {
    if (users.some((u) => u.id === tm.id) || excluded.has(tm.id)) continue;
    users.push({ id: tm.id, name: tm.name, avatarUrl: tm.avatarUrl, email: '', role: 'MEMBER' });
  }
  return users.map((user) => ({ user, position: roles[user.id]?.position, skills: roles[user.id]?.skills ?? [] }));
}

const todayISO = () => format(new Date(), 'yyyy-MM-dd');

// Team select value for a project without a team
const PERSONAL = '__personal__';

// One "connect this repo as <role>" row (repoId '' = not picked yet)
interface RepoRow {
  key: string;
  role: RepoRole;
  repoId: string;
}
let rowSeq = 0;

type GitHubState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; installations: GitHubInstallation[] };

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose, defaultTeamId }) => {
  const { createProject, currentUser } = useWorkspaceStore();
  const { teams, fetchTeams } = useTeamStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [designText, setDesignText] = useState('');
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [projectType, setProjectType] = useState<ProjectType>('WEB');
  const [extraStackInput, setExtraStackInput] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId || '');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Record<string, { position?: ProjectPosition; skills: string[] }>>({});
  const [leaderId, setLeaderId] = useState('');
  const [github, setGithub] = useState<GitHubState>({ status: 'loading' });
  const [installationId, setInstallationId] = useState('');
  const [repoRows, setRepoRows] = useState<RepoRow[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [waitingForInstall, setWaitingForInstall] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Bumped on every open: a GitHub lookup that finishes after the form was reset is discarded
  const formSeq = useRef(0);

  // The modal stays mounted: reset the whole form on every open (no leftovers from the last project)
  useEffect(() => {
    if (!isOpen) return;
    formSeq.current += 1;
    setName('');
    setDescription('');
    setGoal('');
    setDesignText('');
    setStartDate(todayISO());
    setEndDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setProjectType('WEB');
    setExtraStackInput('');
    setSelectedTeamId(defaultTeamId || '');
    setExcluded(new Set());
    setRoles({});
    setLeaderId('');
    setInstallationId('');
    setRepoRows([]);
    setWaitingForInstall(false);
    setConnectError('');
    setSubmitError('');
  }, [isOpen, defaultTeamId]);

  // Team or personal project. Preselect the first team (or personal) when nothing valid is chosen.
  const personalAllowed = isFeatureAvailable('personalProject');
  const isPersonal = selectedTeamId === PERSONAL;
  useEffect(() => {
    if (!isOpen || teams.some((t) => t.id === selectedTeamId)) return;
    if (isPersonal && personalAllowed) return;
    setSelectedTeamId(teams[0]?.id ?? (personalAllowed ? PERSONAL : ''));
  }, [isOpen, teams, selectedTeamId, isPersonal, personalAllowed]);

  const selectedTeam = isPersonal ? undefined : teams.find((t) => t.id === selectedTeamId);
  const members = buildMembers(currentUser, selectedTeam?.members ?? [], excluded, roles);
  const leftOut = (selectedTeam?.members ?? []).filter((tm) => excluded.has(tm.id) && tm.id !== currentUser?.id);

  // Leader: the chosen one if still a member, else me
  const effectiveLeaderId = members.some((m) => m.user.id === leaderId) ? leaderId : currentUser?.id || '';

  // ---- GitHub App installations: orgs/accounts + their repos ----
  const loadInstallations = useCallback(async () => {
    const seq = formSeq.current;
    setGithub((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    try {
      const list = await api.getGitHubInstallations();
      if (seq !== formSeq.current) return;
      setGithub({ status: 'ready', installations: list });
      if (list.length > 0) setWaitingForInstall(false);
      setInstallationId((cur) => (list.some((i) => i.installationId === cur) ? cur : list[0]?.installationId || ''));
    } catch (err) {
      if (seq !== formSeq.current) return;
      console.error('Failed to load GitHub installations:', err);
      setGithub({ status: 'error', message: errorText(err, 'GitHub 연결 정보를 불러오지 못했습니다.') });
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !isFeatureAvailable('githubApp')) return;
    setGithub({ status: 'loading' });
    void loadInstallations();
  }, [isOpen, loadInstallations]);

  // After sending the user to GitHub to install the app, re-check when they come back to this window
  useEffect(() => {
    if (!isOpen || !waitingForInstall) return;
    const onFocus = () => void loadInstallations();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isOpen, waitingForInstall, loadInstallations]);

  const connectGitHub = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectError('');
    try {
      const url = await api.startGitHubInstallation();
      if (!isGitHubInstallUrl(url)) throw new Error('서버가 올바르지 않은 GitHub 설치 주소를 보냈습니다.');
      // Desktop: window.open goes to the system browser (main process). Web: a new tab.
      window.open(url, '_blank', 'noopener,noreferrer');
      setWaitingForInstall(true);
    } catch (err) {
      console.error(err);
      setConnectError(errorText(err, 'GitHub 연결을 시작하지 못했습니다.'));
    } finally {
      setIsConnecting(false);
    }
  };

  const installations = github.status === 'ready' ? github.installations : [];
  const installation = installations.find((i) => i.installationId === installationId);
  // Rows belong to the selected organization: switching it starts the list over
  const selectInstallation = (id: string) => {
    setInstallationId(id);
    setRepoRows([]);
  };
  const usedCommon = repoRows.some((r) => r.role === 'COMMON');
  const addRow = () => {
    if (repoRows.length >= REPOS_MAX) return;
    // Suggest a role nobody has used yet (common at most once)
    const used = new Set(repoRows.map((r) => r.role));
    const role = REPO_ROLES.find((r) => !used.has(r.id))?.id ?? 'BACKEND';
    setRepoRows((prev) => [...prev, { key: `row-${++rowSeq}`, role, repoId: '' }]);
  };
  const updateRow = (key: string, patch: Partial<RepoRow>) =>
    setRepoRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // What gets sent: rows with a repo picked
  const repos: ProjectRepository[] = installation
    ? repoRows.flatMap((row) => {
        const repo = installation.repositories.find((r) => r.id === row.repoId);
        return repo ? [repoFromInstallation(installation, repo, row.role)] : [];
      })
    : [];

  // ---- members ----
  const updateMember = (userId: string, position: ProjectPosition | undefined, skills: string[]) =>
    setRoles((prev) => ({ ...prev, [userId]: { position, skills } }));

  const excludeMember = (userId: string) => {
    if (userId === currentUser?.id) return;
    setExcluded((prev) => new Set(prev).add(userId));
    if (leaderId === userId) setLeaderId('');
  };
  const includeMember = (userId: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const fail = (msg: string) => setSubmitError(msg);
    if (!name.trim()) return fail('프로젝트명을 입력해주세요.');
    if (!description.trim()) return fail('프로젝트 설명을 입력해주세요.');
    if (!goal.trim()) return fail('프로젝트 최종 목표를 입력해주세요.');
    if (!designText.trim()) return fail('프로젝트 설계서를 입력해주세요. AI 업무 생성에도 쓰입니다.');
    if (!startDate || !endDate) return fail('시작일과 종료 예정일을 입력해주세요.');
    if (endDate < startDate) return fail('종료 예정일이 시작일보다 빠릅니다.');
    if (!selectedTeam && !(isPersonal && personalAllowed)) return fail('프로젝트를 만들 팀을 골라주세요.');
    if (!currentUser) return fail('로그인 정보를 확인할 수 없습니다.');
    const noRole = members.find((m) => !m.position || m.skills.length === 0);
    if (noRole) return fail(`${noRole.user.name}님의 포지션과 기술 스택을 1개 이상 골라주세요.`);
    if (repoRows.some((r) => !r.repoId)) return fail('저장소를 고르지 않은 줄이 있습니다. 저장소를 고르거나 삭제해주세요.');
    if (repoRows.filter((r) => r.role === 'COMMON').length > 1) return fail('공통 저장소는 1개만 연결할 수 있습니다.');

    setIsLoading(true);
    setSubmitError('');
    try {
      const result = await createProject({
        name: name.trim(),
        description: description.trim(),
        goal: goal.trim(),
        designText: designText.trim(),
        projectType,
        startDate,
        endDate,
        teamId: selectedTeam?.id,
        leaderId: effectiveLeaderId,
        members: members.map((m) => ({ user: m.user, position: m.position!, skills: m.skills })),
        additionalTechStack: normalizeSkills(extraStackInput.split(',')),
        repositories: repos,
      });
      // The team's project list changed
      fetchTeams().catch((err) => console.error(err));
      onClose();
      if (result.issueImportFailed) {
        window.alert('프로젝트는 만들어졌지만 GitHub 레포의 기존 이슈 일부를 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      setSubmitError(errorText(err, '프로젝트 생성에 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const selectClass =
    'w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary';

  // Deployed service without this backend API: say so instead of a form that can only fail
  if (!isFeatureAvailable('projectCreate')) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" title="새 프로젝트 생성 (Create Project)">
        <NotConnected feature="프로젝트 생성" />
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title="새 프로젝트 생성 (Create Project)"
      description="팀 프로젝트의 주제, 목표, 기간, 설계서와 팀원별 역할·기술 스택, GitHub 레포를 정합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="프로젝트명"
          placeholder="예: 밥친구 (학식 매칭 앱)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PROJECT_LIMITS.NAME_MAX}
          required
        />

        <Textarea
          label="프로젝트 설명 (간단히)"
          placeholder="한두 줄 소개. 예: 같은 시간에 학식 먹을 사람을 찾아주는 앱"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={PROJECT_LIMITS.DESCRIPTION_MAX}
          rows={2}
          required
        />

        <Input
          label="프로젝트 최종 목표 (Goal)"
          placeholder="예: 해커톤 본선 진출, 경진대회 예선 통과"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={PROJECT_LIMITS.GOAL_MAX}
          required
        />

        <div>
          <Textarea
            label="프로젝트 설계서"
            placeholder={'기능 목록, 화면 구성, API·DB 설계, 일정 등 정해 둔 내용을 자유롭게 붙여 넣으세요.\nAI 이슈 자동 생성이 이 내용을 바탕으로 업무를 나눕니다.'}
            value={designText}
            onChange={(e) => setDesignText(e.target.value)}
            maxLength={PROJECT_LIMITS.DESIGN_TEXT_MAX}
            rows={8}
            required
          />
          <p className="mt-1 text-[10px] text-text-muted text-right">
            {designText.length.toLocaleString()} / {PROJECT_LIMITS.DESIGN_TEXT_MAX.toLocaleString()}자
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="project-type" className="block text-xs font-medium text-text-secondary mb-1">
              프로젝트 유형
            </label>
            <select
              id="project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className={selectClass}
            >
              <option value="WEB">Web</option>
              <option value="APP">App</option>
              <option value="AI">AI / ML</option>
              <option value="EMBEDDED">Embedded</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Input type="date" label="시작일" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input
            type="date"
            label="종료 예정일"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        {/* Team project (members come from the team) or personal project (just me) */}
        <div>
          <label htmlFor="project-team" className="block text-xs font-medium text-text-secondary mb-1">
            소속 팀 (Team)
          </label>
          <select
            id="project-team"
            value={selectedTeamId}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setExcluded(new Set());
            }}
            className={selectClass}
          >
            {teams.length === 0 && !personalAllowed && <option value="">팀이 없습니다</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={PERSONAL} disabled={!personalAllowed}>
              {personalAllowed ? '팀 없음 (개인 프로젝트)' : '팀 없음 (개인 프로젝트, 서버 준비 중)'}
            </option>
          </select>
          <p className="mt-1 text-[11px] text-text-muted">
            {isPersonal
              ? '혼자 진행하는 프로젝트입니다. 멤버는 나 한 명이고, 리더도 내가 됩니다.'
              : teams.length === 0
              ? '먼저 팀을 만들어주세요. 개인 프로젝트는 서버가 지원하면 바로 쓸 수 있습니다.'
              : '프로젝트 멤버는 이 팀의 팀원 중에서 정합니다. 새 사람은 팀에 먼저 초대해주세요.'}
          </p>
        </div>

        {/* Members: per-member position & tech stack */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-text-secondary">프로젝트 멤버와 역할 ({members.length}명)</span>
          <div className="space-y-2">
            {members.map((m) => {
              const isMe = m.user.id === currentUser?.id;
              const missing = !m.position || m.skills.length === 0;
              return (
                <div key={m.user.id} className="p-3 rounded-lg border border-border bg-surface-hover/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar src={m.user.avatarUrl} name={m.user.name} size="xs" />
                      <span className="text-xs font-semibold text-text-primary truncate">{m.user.name}</span>
                      {isMe && <span className="text-[10px] text-text-muted shrink-0">나</span>}
                      {m.user.id === effectiveLeaderId && (
                        <span className="text-[10px] font-semibold text-amber-600 shrink-0">리더</span>
                      )}
                      {missing && <span className="text-[10px] text-text-muted shrink-0">포지션·기술 스택 필요</span>}
                    </div>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => excludeMember(m.user.id)}
                        aria-label={`${m.user.name} 이 프로젝트에서 제외`}
                        title="이 프로젝트 멤버에서 제외 (팀에서는 빠지지 않음)"
                        className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MemberRoleEditor
                    position={m.position}
                    skills={m.skills}
                    onChange={(position, skills) => updateMember(m.user.id, position, skills)}
                  />
                </div>
              );
            })}
          </div>
          {leftOut.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
              <UserMinus className="h-3.5 w-3.5" />
              <span>제외한 팀원:</span>
              {leftOut.map((tm) => (
                <button
                  key={tm.id}
                  type="button"
                  onClick={() => includeMember(tm.id)}
                  title="다시 멤버로 추가"
                  className="h-6 px-2 rounded-full border border-border bg-surface hover:border-primary/50 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {tm.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Project leader */}
        <div>
          <label htmlFor="project-leader" className="block text-xs font-medium text-text-secondary mb-1">
            프로젝트 리더 (Leader)
          </label>
          <select id="project-leader" value={effectiveLeaderId} onChange={(e) => setLeaderId(e.target.value)} className={selectClass}>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
                {m.user.id === currentUser?.id ? ' (나)' : ''}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="추가 기술 스택 (선택, 쉼표로 구분)"
          placeholder="팀원들이 고른 기술은 자동으로 포함됩니다. 예: GitHub Actions, Vercel"
          value={extraStackInput}
          onChange={(e) => setExtraStackInput(e.target.value)}
        />

        {/* GitHub 연결: organization (GitHub App installation) -> repos to connect, one row per repo */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5" />
              GitHub 연결 <span className="font-normal text-text-muted">(선택)</span>
            </span>
            {github.status === 'ready' && installations.length > 0 && (
              <button
                type="button"
                onClick={() => void loadInstallations()}
                className="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1"
                title="GitHub 연결 정보 다시 불러오기"
              >
                <RefreshCw className="h-3 w-3" />
                새로고침
              </button>
            )}
          </div>

          {!isFeatureAvailable('githubApp') ? (
            <NotConnected feature="GitHub 연결" />
          ) : github.status === 'loading' ? (
            <p className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              GitHub 연결 정보를 불러오는 중…
            </p>
          ) : github.status === 'error' ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-red-500">{github.message}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadInstallations()}>
                다시 시도
              </Button>
            </div>
          ) : installations.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-text-secondary">
                GitHub가 아직 연결되지 않았습니다. FlowMate GitHub 앱을 Organization(또는 내 계정)에 설치하면
                저장소를 고를 수 있고, 기존 GitHub 이슈를 프로젝트 업무로 가져옵니다.
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => void connectGitHub()} isLoading={isConnecting} className="gap-1.5">
                  <Github className="h-3.5 w-3.5" />
                  깃허브 연결하기
                </Button>
                {waitingForInstall && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void loadInstallations()} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    설치 완료 후 다시 불러오기
                  </Button>
                )}
              </div>
              {waitingForInstall && (
                <p className="text-[11px] text-text-muted">
                  열린 GitHub 페이지에서 설치를 마치고 돌아오면 자동으로 다시 확인합니다. 반영까지 몇 초 걸릴 수 있습니다.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Organization */}
              <div>
                <label htmlFor="project-org" className="block text-[11px] font-medium text-text-secondary mb-1">
                  Organization
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="project-org"
                    value={installationId}
                    onChange={(e) => selectInstallation(e.target.value)}
                    className={selectClass}
                  >
                    {installations.map((i) => (
                      <option key={i.installationId} value={i.installationId}>
                        {i.accountLogin}
                        {i.accountType === 'User' ? ' (개인 계정)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void connectGitHub()}
                    disabled={isConnecting}
                    className="shrink-0 h-8 px-2.5 rounded-md border border-border text-[11px] text-text-secondary hover:bg-surface-hover flex items-center gap-1 disabled:opacity-50"
                    title="GitHub에서 FlowMate 앱이 접근할 저장소를 바꾸거나 다른 Organization에 설치합니다"
                  >
                    <ExternalLink className="h-3 w-3" />
                    저장소 권한 변경
                  </button>
                </div>
              </div>

              {/* Repositories to connect */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-text-secondary">연결할 저장소</span>
                {repoRows.length === 0 && (
                  <p className="text-[11px] text-text-muted">아직 연결할 저장소가 없습니다. 아래에서 추가하세요.</p>
                )}
                {repoRows.map((row) => {
                  // Repos already picked in other rows can't be picked again
                  const takenElsewhere = new Set(repoRows.filter((r) => r.key !== row.key).map((r) => r.repoId));
                  const options = (installation?.repositories || []).filter((r) => !takenElsewhere.has(r.id));
                  return (
                    <div key={row.key} className="flex items-center gap-2">
                      <select
                        aria-label="저장소 역할"
                        value={row.role}
                        onChange={(e) => updateRow(row.key, { role: e.target.value as RepoRole })}
                        className="h-8 w-32 shrink-0 rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {REPO_ROLES.map((r) => (
                          <option key={r.id} value={r.id} disabled={r.id === 'COMMON' && usedCommon && row.role !== 'COMMON'}>
                            역할: {r.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="저장소"
                        value={row.repoId}
                        onChange={(e) => updateRow(row.key, { repoId: e.target.value })}
                        className={`${selectClass} font-mono ${row.repoId ? '' : 'text-text-muted'}`}
                      >
                        <option value="">저장소 선택…</option>
                        {options.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                            {r.private ? ' (private)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setRepoRows((prev) => prev.filter((r) => r.key !== row.key))}
                        className="shrink-0 h-8 px-2.5 rounded-md border border-border text-[11px] text-text-secondary hover:text-red-500 hover:border-red-300 flex items-center gap-1"
                        aria-label="이 저장소 삭제"
                      >
                        <Trash2 className="h-3 w-3" />
                        삭제
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addRow}
                  disabled={repoRows.length >= REPOS_MAX || (installation?.repositories.length ?? 0) <= repoRows.length}
                  className="h-8 px-3 rounded-md border border-dashed border-border text-[11px] text-text-secondary hover:bg-surface-hover flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  저장소 추가
                </button>
              </div>

              <p className="text-[11px] text-text-muted flex items-start gap-1">
                <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                기존 GitHub 이슈를 프로젝트 업무로 가져옵니다. GitHub 앱에 권한을 준 저장소만 보이며, 공통 저장소는 1개까지 연결할 수 있습니다.
              </p>
            </>
          )}
          {connectError && <p className="text-[11px] text-red-500">{connectError}</p>}
        </div>

        {submitError && (
          <p role="alert" className="text-[11px] text-red-500">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading} disabled={teams.length === 0 && !personalAllowed}>
            프로젝트 생성
          </Button>
        </div>
      </form>
    </Modal>
  );
};
