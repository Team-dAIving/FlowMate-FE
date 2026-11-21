import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  Plus,
  GitBranch,
  Video,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';

export const PersonalDashboard: React.FC = () => {
  const { currentUser, projects, setCurrentView } = useWorkspaceStore();
  const { tasks } = useTaskStore();
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
  const activeTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW');
  const completedTasks = myTasks.filter((t) => t.status === 'DONE');
  const overdueTasks = myTasks.filter((t) => {
    if (!t.dueDate || t.status === 'DONE') return false;
    return new Date(t.dueDate) < new Date('2026-11-18');
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Greeting & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="text-xs font-mono text-text-muted">~/workspace/dashboard</div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1">
            Good evening, {currentUser?.name || 'Developer'}.
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            오늘 집중할 업무와 다가오는 회의 및 마감일을 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecordMeetingModalOpen(true)}
            className="text-xs"
          >
            <Video className="h-3.5 w-3.5 text-primary" />
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

          <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle">
            {myTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                현재 할당된 업무가 없습니다.
              </div>
            ) : (
              myTasks.map((task) => (
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
              ))
            )}
          </div>

          {/* Project Progress preview */}
          <div className="pt-2">
            <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase mb-2">
              PROJECTS OVERVIEW
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.slice(0, 2).map((p) => (
                <Card
                  key={p.id}
                  hoverEffect
                  onClick={() => setCurrentView('project-detail', p.id)}
                  className="p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-text-primary">
                      <span>{p.name}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-text-secondary">
                      {p.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: UPCOMING & Recent Meetings */}
        <div className="space-y-6">
          {/* UPCOMING Deadlines */}
          <div>
            <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase mb-2">
              UPCOMING
            </div>
            <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle">
              <div className="p-3 flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-primary shrink-0 w-12">
                  11.18
                </span>
                <div>
                  <div className="text-xs font-medium text-text-primary">
                    팀 스프린트 회의 (AI 파이프라인)
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">14:00 ~ 15:00 · Google Meet</div>
                </div>
              </div>
              <div className="p-3 flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-amber-500 shrink-0 w-12">
                  11.19
                </span>
                <div>
                  <div className="text-xs font-medium text-text-primary">
                    FM-103 GitHub 연동 API 마감일
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">Issue 생성 및 단방향 동기화 검증</div>
                </div>
              </div>
              <div className="p-3 flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold text-text-muted shrink-0 w-12">
                  11.20
                </span>
                <div>
                  <div className="text-xs font-medium text-text-primary">
                    데스크톱 UI 디자인 시스템 리뷰
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">Linear 테마 일관성 확인</div>
                </div>
              </div>
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
                    <Badge variant="default" className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      AI 완료
                    </Badge>
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
