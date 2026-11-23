import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  Plus,
  GitBranch,
  Sparkles,
  Copy,
  Check,
  Mic,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useUIStore } from '../../store/useUIStore';
import { useTeamStore } from '../../store/useTeamStore';
import { groupTasksByProject, getProjectTeams } from '../../utils/projectTeams';
import { getProjectLeader } from '../../utils/projectLeader';
import { ProjectIdeButtons } from '../projects/ProjectIdeButtons';
import { MeetingStatusBadge } from '../meetings/MeetingStatusBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';
import { isOverdue } from '../../utils/dates';
import { projectProgress } from '../../utils/progress';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { isFeatureAvailable } from '../../services/features';
import { NotConnected } from '../ui/NotConnected';

export const PersonalDashboard: React.FC = () => {
  const { currentUser, projects, setCurrentView } = useWorkspaceStore();
  const { tasks } = useTaskStore();
  const { teams } = useTeamStore();
  const { meetings } = useMeetingStore();
  const { setCreateTaskModalOpen, setRecordMeetingModalOpen, setSelectedTaskIdForDetail } = useUIStore();

  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = () => {
    if (currentUser?.userCode) {
      navigator.clipboard
        .writeText(currentUser.userCode)
        .then(() => {
          setCodeCopied(true);
          setTimeout(() => setCodeCopied(false), 2000);
        })
        .catch(() => {
          // Clipboard can be blocked (permissions / insecure context) — code is still select-all-able
        });
    }
  };

  // My tasks
  const myTasks = tasks.filter((t) => t.assignee?.id === currentUser?.id);
  const myTaskGroups = groupTasksByProject(myTasks, projects);

  // My open tasks across every team, nearest deadline first (students juggle several teams at once)
  const today = startOfDay(new Date());
  const upcoming = myTasks
    .filter((t) => t.status !== 'DONE' && t.dueDate)
    .map((t) => ({
      task: t,
      dDay: differenceInCalendarDays(parseISO(t.dueDate!), today),
      teamName: getProjectTeams(t.projectId, teams)[0]?.name,
    }))
    .sort((a, b) => a.dDay - b.dDay)
    .slice(0, 5);
  const activeTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW');
  const completedTasks = myTasks.filter((t) => t.status === 'DONE');
  const overdueTasks = myTasks.filter(isOverdue);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {!isFeatureAvailable('taskWrite') && <NotConnected feature="업무 상태·내용 수정과 회의 녹음" />}
      {/* Top Greeting & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1">
            안녕하세요, {currentUser?.name ? `${currentUser.name}님` : '반가워요'}!
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            참여 중인 팀들의 내 할 일과 다가오는 마감을 한눈에 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecordMeetingModalOpen(true)}
            className="text-xs"
          >
            <Mic className="h-3.5 w-3.5 text-primary" />
            <span>회의 녹음</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateTaskModalOpen(true)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>새 업무 등록</span>
          </Button>
        </div>
      </div>

      {/* User Code Banner — for team invitations */}
      {currentUser?.userCode && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/[0.03] dark:bg-primary/[0.06]">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono font-semibold text-text-muted uppercase tracking-wider">
              내 유저 코드
            </div>
            <div className="font-mono text-lg font-bold text-primary tracking-[0.2em] select-all">
              {currentUser.userCode}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-text-muted hidden sm:block">
              팀 초대 시 이 코드를 공유하세요
            </p>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-surface-hover text-text-secondary transition-colors"
            >
              {codeCopied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>복사</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MY WORK Stats Cards (Section 4.3 specification) */}
      <div>
        <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase mb-2">
          MY WORK
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card
            hoverEffect
            onClick={() => setCurrentView('tasks')}
            className="p-3.5 flex items-center justify-between border-blue-500/20 bg-blue-500/[0.02]"
          >
            <div className="space-y-1">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                Active Tasks
              </span>
              <div className="text-2xl font-bold font-mono text-text-primary">
                {activeTasks.length.toString().padStart(2, '0')}
              </div>
            </div>
            <Badge status="IN_PROGRESS" />
          </Card>

          <Card
            hoverEffect
            onClick={() => setCurrentView('tasks')}
            className="p-3.5 flex items-center justify-between border-emerald-500/20 bg-emerald-500/[0.02]"
          >
            <div className="space-y-1">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Completed
              </span>
              <div className="text-2xl font-bold font-mono text-text-primary">
                {completedTasks.length.toString().padStart(2, '0')}
              </div>
            </div>
            <Badge status="DONE" />
          </Card>

          <Card
            hoverEffect
            onClick={() => setCurrentView('tasks')}
            className="p-3.5 flex items-center justify-between border-red-500/20 bg-red-500/[0.02]"
          >
            <div className="space-y-1">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                Overdue
              </span>
              <div className="text-2xl font-bold font-mono text-text-primary">
                {overdueTasks.length.toString().padStart(2, '0')}
              </div>
            </div>
            <span className="text-[10px] font-mono text-red-500 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded font-medium">
              Action Required
            </span>
          </Card>
        </div>
      </div>

      {/* Main Grid: My Tasks & Upcoming / Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Tasks */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase">
              MY TASKS ({myTasks.length})
            </div>
            <button
              onClick={() => setCurrentView('tasks')}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>전체 보기</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {myTasks.length === 0 ? (
            <div className="border border-border rounded-lg bg-surface overflow-hidden shadow-subtle p-8 text-center text-xs text-text-muted">
              현재 할당된 업무가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {myTaskGroups.map((group) => (
                <div
                  key={group.projectId}
                  className="border border-border rounded-lg bg-surface overflow-hidden shadow-subtle"
                >
                  <div className="px-3 py-2 bg-surface-hover/50 border-b border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary min-w-0">
                      <span className="truncate">
                        {group.project?.name ?? group.tasks[0]?.projectName ?? '알 수 없는 프로젝트'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted shrink-0">
                      {group.tasks.length}건
                    </span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskIdForDetail(task.id)}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-surface-hover cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-medium text-text-primary truncate">
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {task.githubIssue && (
                            <span
                              title={`GitHub Issue #${task.githubIssue.number}`}
                              className="text-[10px] font-mono text-text-muted hover:text-text-primary flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded border border-border"
                            >
                              <GitBranch className="h-2.5 w-2.5 text-text-muted" />
                              #{task.githubIssue.number}
                            </span>
                          )}
                          <Badge priority={task.priority} />
                          <Badge status={task.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Project Progress preview */}
          <div className="pt-2">
            <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase mb-2">
              PROJECTS OVERVIEW
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((p) => {
                const projectTeams = getProjectTeams(p.id, teams);
                const leader = getProjectLeader(p);
                return (
                  <Card
                    key={p.id}
                    hoverEffect
                    onClick={() => setCurrentView('project-detail', p.id)}
                    className="p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-text-primary min-w-0">
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-text-secondary">
                        {projectProgress(p.id, tasks)}%
                      </span>
                    </div>
                    <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${projectProgress(p.id, tasks)}%` }}
                      />
                    </div>

                    {/* Team(s) & leader */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {projectTeams.length === 0 ? (
                        <span className="text-text-muted italic">소속 팀 없음</span>
                      ) : (
                        projectTeams.map((team) => (
                          <span
                            key={team.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-surface-hover text-text-primary font-medium"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: team.color || '#4F46E5' }}
                            />
                            {team.name}
                          </span>
                        ))
                      )}
                      <span className="text-text-muted ml-auto">
                        리더: {leader ? leader.name : '미지정'}
                      </span>
                    </div>

                    <ProjectIdeButtons projectId={p.id} />
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: UPCOMING & Recent Meetings */}
        <div className="space-y-6">
          {/* UPCOMING Deadlines */}
          <div>
            <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase mb-2">
              UPCOMING DEADLINES
            </div>
            <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle">
              {upcoming.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">다가오는 마감이 없습니다.</div>
              ) : (
                upcoming.map(({ task, dDay, teamName }) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskIdForDetail(task.id)}
                    className="p-3 flex items-start gap-2.5 hover:bg-surface-hover cursor-pointer transition-colors"
                  >
                    <span
                      className={`font-mono text-xs font-semibold shrink-0 w-12 ${
                        dDay < 0 ? 'text-red-500' : dDay <= 2 ? 'text-amber-500' : 'text-primary'
                      }`}
                    >
                      {dDay === 0 ? 'D-day' : dDay > 0 ? `D-${dDay}` : `D+${-dDay}`}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text-primary truncate">{task.title}</div>
                      <div className="text-[11px] text-text-muted mt-0.5 truncate">
                        {teamName ? `${teamName} · ` : ''}
                        {task.projectName}
                        {task.dueDate ? ` · ${formatDate(task.dueDate, 'MM.dd')}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent AI Meetings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>RECENT MEETINGS</span>
              </div>
              <button
                onClick={() => setCurrentView('meetings')}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                더보기
              </button>
            </div>
            <div className="space-y-2">
              {meetings.slice(0, 2).map((m) => (
                <div
                  key={m.id}
                  onClick={() => setCurrentView('meeting-detail', m.id)}
                  className="p-3 rounded-lg border border-border bg-surface hover:border-primary/50 cursor-pointer transition-all shadow-subtle space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary truncate">
                      {m.title}
                    </span>
                    <MeetingStatusBadge status={m.status} />
                  </div>
                  <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                    {m.summary}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-text-muted">
                    <span>{formatDate(m.meetingDate)}</span>
                    <span>Action Items: {m.actionItems?.length || 0}건</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
