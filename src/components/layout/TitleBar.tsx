import React from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Minus,
  Square,
  X,
  Mic,
  Command,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const TitleBar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    unreadCount,
    setCommandPaletteOpen,
    setNotificationPanelOpen,
    isNotificationPanelOpen,
    setRecordMeetingModalOpen,
  } = useUIStore();

  const { currentWorkspace } = useWorkspaceStore();
  const isElectron = !!window.electronAPI?.isElectron;

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <header className="h-10 w-full bg-surface border-b border-border flex items-center justify-between px-3 select-none app-drag-region z-40 shrink-0">
      {/* Left: App Brand & Workspace */}
      <div className="flex items-center gap-2 app-no-drag">
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-tight text-text-primary">
          <div className="w-4 h-4 rounded bg-primary flex items-center justify-center text-white font-mono text-[10px] font-bold">
            F
          </div>
          <span>FlowMate</span>
        </div>

        {currentWorkspace && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-text-secondary pl-2 border-l border-border">
            <span className="font-medium text-text-primary">{currentWorkspace.name}</span>
          </div>
        )}
      </div>

      {/* Center: Raycast / Linear style Quick Search (Ctrl+K) */}
      <div className="flex items-center app-no-drag max-w-sm w-full mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-6 px-2.5 rounded-md bg-surface-hover hover:bg-border/50 border border-border/80 flex items-center justify-between text-xs text-text-muted transition-colors shadow-subtle group"
        >
          <div className="flex items-center gap-1.5">
            <Search className="h-3 w-3 text-text-muted group-hover:text-text-primary transition-colors" />
            <span className="text-[11px]">검색 또는 명령어 입력...</span>
          </div>
          <div className="flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.2 rounded bg-surface border border-border/70 text-text-secondary">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right: Quick Actions & Window Controls */}
      <div className="flex items-center gap-1.5 app-no-drag">
        {/* Quick Meeting Record Button */}
        <button
          onClick={() => setRecordMeetingModalOpen(true)}
          className="h-6 px-2 rounded flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-medium transition-colors"
          title="새 회의 녹음 시작"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <Mic className="h-3 w-3" />
          <span className="hidden md:inline">회의 녹음</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotificationPanelOpen(!isNotificationPanelOpen)}
          className="relative h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title="알림 센터"
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </button>

        {/* Electron Window Controls */}
        {isElectron && (
          <div className="flex items-center pl-1.5 ml-1 border-l border-border">
            <button
              onClick={handleMinimize}
              className="h-7 w-7 flex items-center justify-center text-text-secondary hover:bg-surface-hover hover:text-text-primary rounded"
              title="최소화"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={handleMaximize}
              className="h-7 w-7 flex items-center justify-center text-text-secondary hover:bg-surface-hover hover:text-text-primary rounded"
              title="최대화"
            >
              <Square className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={handleClose}
              className="h-7 w-7 flex items-center justify-center text-text-secondary hover:bg-status-danger hover:text-white rounded transition-colors"
              title="닫기"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
