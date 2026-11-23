import React from 'react';
import { Video, Mic, Sparkles, Clock, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatDate, formatDuration } from '../../utils/formatters';
import { MeetingStatusBadge } from './MeetingStatusBadge';
import { isFeatureAvailable } from '../../services/features';
import { NotConnected } from '../ui/NotConnected';

export const MeetingList: React.FC = () => {
  const { meetings } = useMeetingStore();
  const { setCurrentView } = useWorkspaceStore();
  const { setRecordMeetingModalOpen } = useUIStore();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {!isFeatureAvailable('meetingWrite') && <NotConnected feature="회의 녹음·AI 분석" />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1 flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <span>회의록 및 AI 음성 분석 (Meetings)</span>
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            회의 녹음 및 STT 결과를 확인하고 AI가 도출한 업무를 승인하여 프로젝트에 반영합니다.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setRecordMeetingModalOpen(true)}
          className="text-xs gap-1.5"
        >
          <Mic className="h-3.5 w-3.5" />
          <span>새 회의 녹음</span>
        </Button>
      </div>

      {/* Meetings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {meetings.map((meeting) => {
          const actionItems = meeting.actionItems || [];
          const approvedCount = actionItems.filter((a) => a.approvalStatus === 'APPROVED').length;

          return (
            <Card
              key={meeting.id}
              hoverEffect
              onClick={() => setCurrentView('meeting-detail', meeting.id)}
              className="p-5 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Top Badge & Duration */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-hover border border-border text-text-secondary">
                      {meeting.projectName || 'FlowMate'}
                    </span>
                    <span className="font-mono text-xs text-text-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(meeting.audioDurationSeconds || 0)}
                    </span>
                  </div>

                  <MeetingStatusBadge status={meeting.status} />
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors flex items-center justify-between">
                  <span className="truncate">{meeting.title}</span>
                  <ArrowRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </h3>

                {/* AI Summary Preview */}
                <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                  {meeting.summary || 'AI 분석 요약이 생성되지 않았습니다.'}
                </p>

                {/* Action Items count pill */}
                {actionItems.length > 0 && (
                  <div className="p-2.5 rounded-md bg-surface-hover/70 border border-border/60 flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium">추출된 Action Items</span>
                    <span className="font-mono font-bold text-primary">
                      {approvedCount} / {actionItems.length}건 승인됨
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom: Participants & Date */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-text-muted">
                <div className="flex items-center -space-x-1.5">
                  {(meeting.participants || []).slice(0, 4).map((user) => (
                    <Avatar
                      key={user.id}
                      src={user.avatarUrl}
                      name={user.name}
                      size="xs"
                      className="border-2 border-surface"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(meeting.meetingDate)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
