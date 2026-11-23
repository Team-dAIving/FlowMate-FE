import React, { useEffect, useState } from 'react';
import { isFeatureAvailable } from '../../services/features';
import { NotConnected } from '../ui/NotConnected';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  GitBranch,
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  Check,
  X,
  Edit2,
  Trash2,
  FileText,
  ListTodo,
  Volume2,
  ShieldCheck,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useTaskStore } from '../../store/useTaskStore';
import { Tabs } from '../ui/Tabs';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Input, Textarea } from '../ui/Input';
import { getProjectMemberUsers } from '../../utils/projectMembers';
import { ActionItem, TaskPriority } from '../../types';
import { formatDate, formatDuration } from '../../utils/formatters';
import { daysFromTodayISO } from '../../utils/dates';
import { safeHref } from '../../utils/github';

export const MeetingDetail: React.FC = () => {
  const { selectedMeetingId, setCurrentView, projects, currentUser } = useWorkspaceStore();
  const { meetings, approveActionItem, rejectActionItem, analyzeMeeting, isAnalyzing } = useMeetingStore();
  const { fetchTasks } = useTaskStore();

  // No silent fallback to another meeting: that would show (and let you approve) the wrong team's items
  const meeting = meetings.find((m) => m.id === selectedMeetingId);

  const [activeTab, setActiveTab] = useState<'summary' | 'action-items' | 'transcript'>('action-items');

  // Edit action item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [createGitHubIssueOnApprove, setCreateGitHubIssueOnApprove] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null); // approve/reject in flight
  const [actionError, setActionError] = useState('');

  // This view stays mounted across meetings: drop an open edit/error from the previous one
  useEffect(() => {
    setEditingId(null);
    setActionError('');
  }, [selectedMeetingId]);

  if (!meeting) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-xs text-text-muted">회의를 찾을 수 없습니다. 삭제되었거나 다른 팀의 회의일 수 있습니다.</p>
        <Button size="sm" variant="outline" onClick={() => setCurrentView('meetings')}>
          회의 목록으로
        </Button>
      </div>
    );
  }

  // Action item 담당자는 회의가 속한 프로젝트의 멤버로 한정
  const projectMembers = getProjectMemberUsers(projects.find((p) => p.id === meeting.projectId), currentUser);

  const actionItems = meeting.actionItems || [];
  const pendingItems = actionItems.filter((a) => a.approvalStatus === 'PENDING');
  const approvedItems = actionItems.filter((a) => a.approvalStatus === 'APPROVED');

  const startEdit = (item: ActionItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditAssigneeId(
      projectMembers.some((m) => m.id === item.assigneeId) ? item.assigneeId! : currentUser?.id || projectMembers[0]?.id || ''
    );
    setEditDueDate(item.dueDate || daysFromTodayISO(7));
    setEditPriority(item.priority);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleApprove = async (item: ActionItem) => {
    // A double click used to create the task (and GitHub issue) twice
    if (busyItemId) return;
    setBusyItemId(item.id);
    setActionError('');
    try {
      await approveActionItem(meeting.id, item.id, {
        createGitHubIssue: createGitHubIssueOnApprove,
        customData: editingId === item.id ? {
          title: editTitle,
          description: editDesc,
          assigneeId: editAssigneeId,
          assigneeName: projectMembers.find((m) => m.id === editAssigneeId)?.name,
          dueDate: editDueDate,
          priority: editPriority,
        } : undefined,
      });
      setEditingId(null);
      await fetchTasks();
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error && err.message ? err.message : '승인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleReject = async (itemId: string) => {
    if (busyItemId) return;
    if (!window.confirm('이 Action Item을 거절하시겠습니까?')) return;
    setBusyItemId(itemId);
    setActionError('');
    try {
      await rejectActionItem(meeting.id, itemId);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error && err.message ? err.message : '거절에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setBusyItemId(null);
    }
  };

  const tabs = [
    { id: 'action-items', label: 'Action Items (AI 업무 승인)', count: pendingItems.length },
    { id: 'summary', label: 'AI 요약 & 결정 사항' },
    { id: 'transcript', label: 'Transcript (STT 전문)' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="space-y-2">
        <button
          onClick={() => setCurrentView('meetings')}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>회의록 목록으로 돌아가기</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-hover border border-border text-text-secondary">
                {meeting.projectName || '프로젝트'}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {formatDate(meeting.meetingDate)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              {meeting.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {meeting.status !== 'ANALYZED' && isFeatureAvailable('meetingWrite') && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => analyzeMeeting(meeting.id)}
                isLoading={isAnalyzing}
                className="text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI 재분석 요청</span>
              </Button>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono text-text-secondary shadow-subtle">
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              <span>{formatDuration(meeting.audioDurationSeconds || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {!isFeatureAvailable('meetingWrite') && (
        <NotConnected feature="회의 업무 승인·전문 보기" />
      )}
      {meeting.approvedActionItemCount !== undefined && actionItems.length === 0 && (
        <p className="text-[11px] text-text-muted">이 회의에서 승인된 업무: {meeting.approvedActionItemCount}개</p>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Tab 1: Action Items (Approval flow - Section 4.7) */}
      {activeTab === 'action-items' && (
        <div className="space-y-5">
          {actionError && (
            <p role="alert" className="text-[11px] text-red-500">
              {actionError}
            </p>
          )}
          {/* Guiding principle alert banner */}
          <div className="p-3.5 rounded-lg border border-primary/20 bg-primary-light/40 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-primary">AI 업무 검토 및 승인 원칙:</span>
                <span className="text-text-secondary ml-1">
                  AI는 사용자의 승인 없이 실제 업무나 GitHub Issue를 생성하지 않습니다.
                  추출된 업무 내용을 확인 및 수정한 뒤 승인하면 FlowMate에 즉시 등록됩니다.
                </span>
              </div>
            </div>

            <label className="flex items-center gap-1.5 shrink-0 font-medium text-text-primary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createGitHubIssueOnApprove}
                onChange={(e) => setCreateGitHubIssueOnApprove(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-[11px] flex items-center gap-1">
                <GitBranch className="h-3 w-3 text-primary" />
                승인 시 GitHub Issue 동시 생성
              </span>
            </label>
          </div>

          {/* Action Items List */}
          <div className="space-y-4">
            {actionItems.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-lg bg-surface/50 text-xs text-text-muted">
                도출된 Action Items가 없습니다.
              </div>
            ) : (
              actionItems.map((item) => {
                const isEditing = editingId === item.id;
                const isApproved = item.approvalStatus === 'APPROVED';
                const isPending = item.approvalStatus === 'PENDING';

                return (
                  <Card
                    key={item.id}
                    className={`p-4 transition-all space-y-3 ${
                      isApproved
                        ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                        : isPending
                        ? 'border-primary/40 shadow-card'
                        : 'border-border opacity-60'
                    }`}
                  >
                    {/* Top status bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge approval={item.approvalStatus} />
                        <Badge sync={item.syncStatus} />
                        {!isEditing && <Badge priority={item.priority} />}
                      </div>

                      {/* Header action buttons */}
                      <div className="flex items-center gap-1.5">
                        {isPending && !isEditing && (
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition-colors"
                            title="수정하기"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {isPending && (
                          <button
                            onClick={() => handleReject(item.id)}
                            className="p-1 text-text-muted hover:text-status-danger rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="거절/삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content: Edit Mode vs View Mode */}
                    {isEditing ? (
                      <div className="space-y-3 pt-1">
                        <Input
                          label="업무 제목"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <Textarea
                          label="업무 설명"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          rows={2}
                        />

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              우선순위
                            </label>
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="LOW">LOW</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="HIGH">HIGH</option>
                              <option value="URGENT">URGENT</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              담당자
                            </label>
                            <select
                              value={editAssigneeId}
                              onChange={(e) => setEditAssigneeId(e.target.value)}
                              className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              {projectMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <Input
                            type="date"
                            label="마감일"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            취소
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(item)} isLoading={busyItemId === item.id} disabled={busyItemId !== null}>
                            저장 및 승인
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-text-primary leading-tight">
                          {item.title}
                        </h4>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {item.description}
                        </p>

                        {/* Transcript Source Citation */}
                        {item.sourceQuote && (
                          <div className="p-2 rounded bg-surface-hover/60 border-l-2 border-primary text-[11px] text-text-muted italic">
                            "{item.sourceQuote}"
                          </div>
                        )}

                        {/* Footer Metadata & Approve Action */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
                          <div className="flex items-center gap-4 text-text-secondary">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="text-text-muted">담당:</span>
                              {item.assigneeName || '미지정'}
                            </span>
                            <span className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-text-muted">마감:</span>
                              {formatDate(item.dueDate)}
                            </span>
                          </div>

                          {/* Approval status or Approve trigger */}
                          <div>
                            {isApproved ? (
                              <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>FlowMate 업무 생성 완료</span>
                                {item.githubIssueUrl && (
                                  <a
                                    href={safeHref(item.githubIssueUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary hover:underline flex items-center gap-0.5 ml-2 font-mono text-[11px]"
                                  >
                                    <GitBranch className="h-3 w-3" />
                                    <span>GitHub Issue</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            ) : isPending ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleApprove(item)}
                                  isLoading={busyItemId === item.id}
                                  disabled={busyItemId !== null}
                                  className="text-xs h-7 gap-1"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>업무 승인 및 생성</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-red-500">거절된 업무</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: AI Summary & Decisions */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            {/* Summary */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>AI 회의 요약 (Executive Summary)</span>
              </div>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                {meeting.summary}
              </p>
            </Card>

            {/* Decisions */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>주요 결정 사항 (Key Decisions)</span>
              </div>
              <div className="space-y-2">
                {(meeting.decisions || []).map((dec, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-text-secondary">
                    <span className="font-mono text-primary font-bold">{i + 1}.</span>
                    <span className="leading-relaxed">{dec}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right: Meeting Metadata */}
          <div className="space-y-4">
            <Card className="p-4 space-y-3 text-xs">
              <div className="font-semibold text-text-muted uppercase text-[11px]">
                회의 참여자 ({meeting.participants?.length || 0})
              </div>
              <div className="space-y-2">
                {(meeting.participants || []).map((user) => (
                  <div key={user.id} className="flex items-center gap-2">
                    <Avatar src={user.avatarUrl} name={user.name} size="xs" />
                    <span className="font-medium text-text-primary">{user.name}</span>
                    {user.department && <span className="text-[10px] text-text-muted">({user.department})</span>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Transcript */}
      {activeTab === 'transcript' && (
        <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle">
          <div className="p-3 bg-surface-hover/50 text-xs font-mono font-semibold text-text-muted flex items-center justify-between">
            <span>SPEAKER & TIMESTAMP</span>
            <span>TRANSCRIPT (Amazon Transcribe)</span>
          </div>

          {(meeting.transcript || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">생성된 STT 전문이 없습니다.</div>
          ) : (
            meeting.transcript?.map((ts) => (
              <div key={ts.id} className="p-3.5 flex items-start gap-4 text-xs hover:bg-surface-hover/30 transition-colors">
                <div className="w-28 shrink-0 space-y-0.5">
                  <span className="font-semibold text-text-primary block">{ts.speaker}</span>
                  <span className="font-mono text-[10px] text-text-muted">{ts.timestamp}</span>
                </div>
                <div className="flex-1 text-text-secondary leading-relaxed">{ts.text}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
