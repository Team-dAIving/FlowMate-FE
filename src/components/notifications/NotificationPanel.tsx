import React from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  GitBranch,
  X,
  CheckCheck,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { NotificationType } from '../../types';
import { formatTimeAgo } from '../../utils/formatters';

export const NotificationPanel: React.FC = () => {
  const {
    isNotificationPanelOpen,
    setNotificationPanelOpen,
    notifications,
    markAsRead,
    markAllAsRead,
  } = useUIStore();

  const { setCurrentView } = useWorkspaceStore();

  if (!isNotificationPanelOpen) return null;

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'APPROVAL_REQUIRED':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      case 'MEETING_ANALYZED':
        return <Sparkles className="h-4 w-4 text-primary" />;
      case 'GITHUB_SYNCED':
        return <GitBranch className="h-4 w-4 text-emerald-500" />;
      case 'TASK_ASSIGNED':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-text-muted" />;
    }
  };

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.linkUrl) {
      if (notif.linkUrl.startsWith('/meetings/')) {
        const meetingId = notif.linkUrl.replace('/meetings/', '');
        setCurrentView('meeting-detail', meetingId);
      } else if (notif.linkUrl.startsWith('/tasks/')) {
        setCurrentView('tasks');
      }
    }
    setNotificationPanelOpen(false);
  };

  return (
    <div className="fixed top-12 right-4 z-50 w-96 rounded-xl border border-border bg-surface shadow-modal overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/80">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-text-primary">알림 센터</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => markAllAsRead()}
            className="text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
            title="모두 읽음 처리"
          >
            <CheckCheck className="h-3 w-3" />
            <span>모두 읽음</span>
          </button>
          <button
            onClick={() => setNotificationPanelOpen(false)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">새로운 알림이 없습니다.</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-3.5 flex items-start gap-3 hover:bg-surface-hover cursor-pointer transition-colors ${
                !notif.read ? 'bg-primary-light/20' : ''
              }`}
            >
              <div className="shrink-0 mt-0.5">{getIcon(notif.type)}</div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-text-primary leading-snug">
                    {notif.title}
                  </h4>
                  <span className="font-mono text-[10px] text-text-muted shrink-0">
                    {formatTimeAgo(notif.createdAt)}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">{notif.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
