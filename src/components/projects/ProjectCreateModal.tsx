import React, { useEffect, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { GitBranch, Loader2, Plus, Search, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { MemberRoleEditor } from './MemberRoleEditor';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTeamStore } from '../../store/useTeamStore';
import { ProjectPosition, ProjectRepository, ProjectType, TeamMember, USER_CODE_PATTERN, User } from '../../types';
import { api } from '../../services/api';
import { POSITIONS, positionColor, projectTechStack } from '../../utils/positions';
import { REPOS_MAX, isValidGitHubOwner, makeRepository, parseRepoInput } from '../../utils/github';

export interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTeamId?: string; // 팀 상세에서 열 때 자동 선택
}

export interface DraftMember {
  user: User;
  fromTeam: boolean; // came from the selected team (vs. invited by user code)
  position?: ProjectPosition;
  skills: string[];
}

const MEMBERS_MAX = 30;

/** Repos tagged with a position nobody holds any more become shared (공통). Same array if nothing changes. */
export function retagOrphanRepos(repos: ProjectRepository[], held: Set<string>): ProjectRepository[] {
  return repos.some((r) => r.position && !held.has(r.position))
    ? repos.map((r) => (r.position && !held.has(r.position) ? { ...r, position: undefined } : r))
    : repos;
}

/**
 * Member list after (re)selecting a team: me first, then the team's members, then people invited by code.
 * Members of a previously selected team are dropped; roles already entered for anyone who stays are kept.
 */
export function mergeTeamMembers(prev: DraftMember[], me: User | null, teamMembers: TeamMember[]): DraftMember[] {
  const byId = new Map(prev.map((m) => [m.user.id, m]));
  const next: DraftMember[] = [];
  if (me) next.push(byId.get(me.id) ?? { user: me, fromTeam: false, skills: [] });
  for (const tm of teamMembers) {
    if (tm.id === me?.id || next.some((n) => n.user.id === tm.id)) continue;
    const existing = byId.get(tm.id);
    next.push(
      existing
        ? { ...existing, fromTeam: true }
        : {
            // Team responses only carry { id, name, avatarUrl }
            user: { id: tm.id, name: tm.name, avatarUrl: tm.avatarUrl, email: '', role: 'MEMBER' },
            fromTeam: true,
            skills: [],
          }
    );
  }
  for (const m of prev) {
    if (!m.fromTeam && m.user.id !== me?.id && !next.some((n) => n.user.id === m.user.id)) next.push(m);
  }
  return next;
}
const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose, defaultTeamId }) => {
  const { createProject, currentWorkspace, currentUser } = useWorkspaceStore();
  const { teams, fetchTeams } = useTeamStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [projectType, setProjectType] = useState<ProjectType>('WEB');
  const [extraStackInput, setExtraStackInput] = useState('');
  const [orgs, setOrgs] = useState<string[]>([]);
  const [githubOrg, setGithubOrg] = useState(''); // picked from the list
  const [orgCustom, setOrgCustom] = useState(false); // typing an org that isn't listed
  const [orgInput, setOrgInput] = useState('');
  const [repos, setRepos] = useState<ProjectRepository[]>([]);
  const [repoInputs, setRepoInputs] = useState<Record<string, string>>({});
  const [repoErrors, setRepoErrors] = useState<Record<string, string>>({});
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId || '');
  const [leaderId, setLeaderId] = useState('');
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Bumped on every open: a user-code lookup that finishes after the form was reset is discarded
  const formSeq = useRef(0);

  // The modal stays mounted: reset the whole form on every open (no leftovers from the last project)
  useEffect(() => {
    if (!isOpen) return;
    formSeq.current += 1;
    setName('');
    setDescription('');
    setGoal('');
    setStartDate(todayISO());
    setEndDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setProjectType('WEB');
    setExtraStackInput('');
    setGithubOrg('');
    setOrgCustom(false);
    setOrgInput('');
    setRepos([]);
    setRepoInputs({});
    setRepoErrors({});
    setSelectedTeamId(defaultTeamId || '');
    setLeaderId('');
    setMembers(currentUser ? [{ user: currentUser, fromTeam: false, skills: [] }] : []);
    setCodeInput('');
    setInviteError('');
    setSubmitError('');
  }, [isOpen, defaultTeamId, currentUser]);

  // Selecting a team fills in its members; people invited by code and already-entered roles are kept
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const teamKey = selectedTeam ? `${selectedTeam.id}:${selectedTeam.memberIds.join(',')}` : '';
  useEffect(() => {
    if (!isOpen) return;
    setMembers((prev) => mergeTeamMembers(prev, currentUser, selectedTeam?.members ?? []));
    // teamKey captures the selected team and its member list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, teamKey, currentUser]);

  // Leader: the chosen one if still a member, else the creator, else the first member
  const effectiveLeaderId = members.some((m) => m.user.id === leaderId)
    ? leaderId
    : members.some((m) => m.user.id === currentUser?.id)
    ? currentUser!.id
    : members[0]?.user.id || '';

  // ---- GitHub: organization + repositories per part of the project ----
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    api
      .getGitHubOrganizations()
      .then((list) => alive && setOrgs(list))
      .catch((err) => console.error('Failed to load GitHub organizations:', err));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const effectiveOrg = orgCustom ? (isValidGitHubOwner(orgInput.trim()) ? orgInput.trim() : '') : githubOrg;
  // A repo row per part: shared (monorepo) + every position some member currently holds
  const heldPositions = POSITIONS.filter((p) => members.some((m) => m.position === p.id));
  const repoRows: { key: string; position?: ProjectPosition; label: string; color: string }[] = [
    { key: 'SHARED', label: '공통', color: positionColor(undefined) },
    ...heldPositions.map((p) => ({ key: p.id, position: p.id, label: p.label, color: p.color })),
  ];
  const heldKey = heldPositions.map((p) => p.id).join(',');

  // When nobody holds a position any more (deselected, changed, member removed), its repos would point
  // at a part no one works on: move them to 공통 instead of losing them, and drop text typed in that row.
  useEffect(() => {
    const held = new Set(heldKey ? heldKey.split(',') : []);
    setRepos((prev) => retagOrphanRepos(prev, held));
    const keep = (rec: Record<string, string>) =>
      Object.fromEntries(Object.entries(rec).filter(([k]) => k === 'SHARED' || held.has(k)));
    setRepoInputs(keep);
    setRepoErrors(keep);
  }, [heldKey]);

  const addRepo = (key: string, position?: ProjectPosition) => {
    const parsed = parseRepoInput(repoInputs[key] || '', effectiveOrg || undefined);
    const setErr = (msg: string) => setRepoErrors((prev) => ({ ...prev, [key]: msg }));
    if (!parsed.ok) return setErr(parsed.error);
    const repo = makeRepository(parsed.owner, parsed.name, position);
    if (repos.some((r) => r.id === repo.id)) return setErr(`${repo.fullName}은(는) 이미 추가되어 있습니다.`);
    if (repos.length >= REPOS_MAX) return setErr(`레포지토리는 최대 ${REPOS_MAX}개까지 추가할 수 있습니다.`);
    setRepos((prev) => [...prev, repo]);
    setRepoInputs((prev) => ({ ...prev, [key]: '' }));
    setErr('');
  };

  const updateMember = (userId: string, position: ProjectPosition | undefined, skills: string[]) =>
    setMembers((prev) => prev.map((m) => (m.user.id === userId ? { ...m, position, skills } : m)));

  const removeMember = (userId: string) => {
    if (userId === currentUser?.id) return;
    setMembers((prev) => prev.filter((m) => m.user.id !== userId));
    // Don't let a removed leader silently become leader again if re-invited
    if (leaderId === userId) setLeaderId('');
  };

  const inviteByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code || isSearching) return;
    if (!USER_CODE_PATTERN.test(code)) return setInviteError('유저 코드는 영문 대문자/숫자 6자리입니다.');
    if (members.length >= MEMBERS_MAX) return setInviteError(`프로젝트 멤버는 최대 ${MEMBERS_MAX}명입니다.`);
    setIsSearching(true);
    setInviteError('');
    try {
      const seq = formSeq.current;
      const found = await api.findUserByCode(code);
      if (seq !== formSeq.current) return; // modal was closed/reopened meanwhile
      if (!found) {
        setInviteError(`"${code}"에 해당하는 유저를 찾을 수 없습니다.`);
      } else if (members.some((m) => m.user.id === found.id)) {
        setInviteError(`${found.name}님은 이미 멤버입니다.`);
      } else {
        setMembers((prev) =>
          prev.some((m) => m.user.id === found.id)
            ? prev
            : [
                ...prev,
                {
                  user: { id: found.id, name: found.name, avatarUrl: found.avatarUrl, userCode: found.userCode, email: '', role: 'MEMBER' },
                  fromTeam: false,
                  skills: [],
                },
              ]
        );
        setCodeInput('');
      }
    } catch (err) {
      console.error(err);
      setInviteError('유저 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!name.trim()) return setSubmitError('프로젝트명을 입력해주세요.');
    if (endDate && startDate && endDate < startDate) return setSubmitError('종료 예정일이 시작일보다 빠릅니다.');
    if (members.length === 0) return setSubmitError('멤버가 1명 이상 필요합니다.');
    if (orgCustom && orgInput.trim() && !effectiveOrg) return setSubmitError('GitHub Organization 이름이 올바르지 않습니다.');
    // Only rows that are on screen (text in a vanished row is dropped, see the heldKey effect)
    if (repoRows.some((row) => (repoInputs[row.key] || '').trim()))
      return setSubmitError('입력 중인 레포지토리가 있습니다. Enter로 추가하거나 지워주세요.');

    const projectMembers = members.map((m) => ({
      user: m.user,
      // permission role: the leader is OWNER, everyone else MEMBER
      role: m.user.id === effectiveLeaderId ? ('OWNER' as const) : ('MEMBER' as const),
      position: m.position,
      skills: m.skills,
    }));
    const extra = extraStackInput.split(',').map((t) => t.trim()).filter(Boolean);

    setIsLoading(true);
    setSubmitError('');
    try {
      const newProject = await createProject({
        workspaceId: currentWorkspace?.id || 'ws-flowmate',
        name: name.trim(),
        description: description.trim(),
        goal: goal.trim(),
        startDate,
        endDate,
        projectType,
        // project stack = what members use + anything extra typed for the project
        techStack: projectTechStack(projectMembers, extra),
        leaderId: effectiveLeaderId || undefined,
        members: projectMembers,
        githubOrg: effectiveOrg || undefined,
        repositories: repos,
      });

      if (selectedTeamId) {
        try {
          await api.linkProjectToTeam(selectedTeamId, newProject.id);
          await fetchTeams();
        } catch (err) {
          // The project exists already: don't let a retry create a duplicate
          console.error(err);
          onClose();
          window.alert('프로젝트는 만들어졌지만 팀 연결에 실패했습니다. 팀 상세 화면에서 다시 연결해주세요.');
          return;
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error && err.message ? err.message : '프로젝트 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectClass =
    'w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title="새 프로젝트 생성 (Create Project)"
      description="팀 프로젝트의 주제, 목표, 기간과 팀원별 역할·기술 스택을 정합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="프로젝트명"
          placeholder="예: 밥친구 (학식 매칭 앱)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
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
          placeholder="예: 해커톤 본선 진출, 경진대회 예선 통과"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />

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
          <Input type="date" label="시작일" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input
            type="date"
            label="종료 예정일"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Team selection */}
        <div>
          <label htmlFor="project-team" className="block text-xs font-medium text-text-secondary mb-1">
            소속 팀 (Team) — 선택
          </label>
          <select id="project-team" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className={selectClass}>
            <option value="">팀 없이 생성</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-text-muted">팀을 고르면 그 팀원이 멤버로 채워지고, 팀 프로젝트로 연결됩니다.</p>
        </div>

        {/* Members: invite + per-member position & tech stack */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              프로젝트 멤버와 역할 ({members.length}명)
            </span>
          </div>

          <div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase());
                  setInviteError('');
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault(); // don't submit the project form
                  if (!e.nativeEvent.isComposing) void inviteByCode();
                }}
                maxLength={6}
                placeholder="팀원 초대: 유저 코드 입력 후 Enter (예: A3H9WD)"
                aria-label="유저 코드로 팀원 초대"
                className="w-full h-8 pl-8 pr-9 rounded-md border border-border bg-surface text-xs text-text-primary font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
              )}
            </div>
            {inviteError && <p className="mt-1 text-[11px] text-red-500">{inviteError}</p>}
          </div>

          <div className="space-y-2">
            {members.map((m) => {
              const isMe = m.user.id === currentUser?.id;
              return (
                <div key={m.user.id} className="p-3 rounded-lg border border-border bg-surface-hover/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar src={m.user.avatarUrl} name={m.user.name} size="xs" />
                      <span className="text-xs font-semibold text-text-primary truncate">{m.user.name}</span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {isMe ? '나' : m.fromTeam ? '팀원' : '초대'}
                      </span>
                      {m.user.id === effectiveLeaderId && (
                        <span className="text-[10px] font-semibold text-amber-600 shrink-0">리더</span>
                      )}
                    </div>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.user.id)}
                        aria-label={`${m.user.name} 멤버에서 제외`}
                        title="이 프로젝트 멤버에서 제외"
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

        {/* GitHub: organization + repositories per part */}
        <div className="space-y-2">
          <div>
            <label htmlFor="project-org" className="block text-xs font-medium text-text-secondary mb-1">
              GitHub Organization (선택)
            </label>
            <div className="flex gap-2">
              <select
                id="project-org"
                value={orgCustom ? '__custom__' : githubOrg}
                onChange={(e) => {
                  const v = e.target.value;
                  setOrgCustom(v === '__custom__');
                  setGithubOrg(v === '__custom__' ? '' : v);
                  setRepoErrors({});
                }}
                className={selectClass}
              >
                <option value="">선택 안 함 (레포를 "owner/이름"으로 입력)</option>
                {orgs.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value="__custom__">직접 입력…</option>
              </select>
              {orgCustom && (
                <input
                  value={orgInput}
                  onChange={(e) => {
                    setOrgInput(e.target.value);
                    setRepoErrors({});
                  }}
                  maxLength={39}
                  placeholder="organization 이름"
                  aria-label="GitHub Organization 직접 입력"
                  aria-invalid={Boolean(orgInput.trim()) && !isValidGitHubOwner(orgInput.trim())}
                  className={`${selectClass} font-mono ${
                    orgInput.trim() && !isValidGitHubOwner(orgInput.trim()) ? 'border-red-400' : ''
                  }`}
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-text-secondary">
              역할별 레포지토리 (선택, {repos.length}개)
            </span>
            {repoRows.map((row) => {
              const rowRepos = repos.filter((r) => (r.position ?? 'SHARED') === row.key);
              return (
                <div key={row.key} className="flex items-start gap-2">
                  <span
                    className="mt-1 w-16 shrink-0 text-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.label}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    {rowRepos.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {rowRepos.map((r) => (
                          <span
                            key={r.id}
                            className="h-6 pl-2 pr-1 rounded-full border border-border bg-surface text-[11px] font-mono text-text-primary flex items-center gap-1"
                          >
                            <GitBranch className="h-3 w-3 text-text-muted" />
                            {r.fullName}
                            <button
                              type="button"
                              onClick={() => setRepos((prev) => prev.filter((x) => x.id !== r.id))}
                              aria-label={`${r.fullName} 제거`}
                              className="p-0.5 rounded-full text-text-muted hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <input
                        value={repoInputs[row.key] || ''}
                        onChange={(e) => {
                          setRepoInputs((prev) => ({ ...prev, [row.key]: e.target.value }));
                          setRepoErrors((prev) => ({ ...prev, [row.key]: '' }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault(); // don't submit the project form
                          if (!e.nativeEvent.isComposing) addRepo(row.key, row.position);
                        }}
                        placeholder={
                          effectiveOrg
                            ? `레포 이름 (${effectiveOrg}/…) 또는 GitHub URL`
                            : 'owner/레포 이름 또는 GitHub URL'
                        }
                        aria-label={`${row.label} 레포지토리 추가`}
                        className="h-7 flex-1 min-w-0 rounded-md border border-border bg-surface px-2 text-[11px] font-mono text-text-primary placeholder:font-sans placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => addRepo(row.key, row.position)}
                        disabled={!(repoInputs[row.key] || '').trim()}
                        aria-label={`${row.label} 레포지토리 추가`}
                        className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-text-secondary hover:bg-surface-hover disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {repoErrors[row.key] && <p className="text-[10px] text-red-500">{repoErrors[row.key]}</p>}
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-text-muted">
              팀원의 포지션을 고르면 그 역할의 레포 칸이 생깁니다. 하나의 레포를 함께 쓰면 "공통"에 넣으세요.
              그 역할을 맡은 사람이 없어지면 해당 레포는 "공통"으로 옮겨집니다.
            </p>
            {effectiveOrg && repos.some((r) => r.owner.toLowerCase() !== effectiveOrg.toLowerCase()) && (
              <p className="text-[11px] text-amber-600">
                이미 추가한 레포 중 {effectiveOrg}가 아닌 계정의 레포가 있습니다. 그대로 저장됩니다.
              </p>
            )}
          </div>
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
          <Button type="submit" size="sm" isLoading={isLoading}>
            프로젝트 생성
          </Button>
        </div>
      </form>
    </Modal>
  );
};
