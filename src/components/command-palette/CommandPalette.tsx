import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Video,
  FolderKanban,
  CheckSquare,
  Users2,
  LayoutDashboard,
  Moon,
  Sun,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setCreateTaskModalOpen,
    setRecordMeetingModalOpen,
    setCreateProjectModalOpen,
    setCreateTeamModalOpen,
    theme,
    toggleTheme,
  } = useUIStore();

  const { setCurrentView, projects, setCurrentProjectId } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global keydown listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'c' && !isCommandPaletteOpen) {
        // Linear shortcut 'c' to create task if not typing in an input
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          setCreateTaskModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen, setCreateTaskModalOpen]);

  // IPC listener from Electron global shortcut
  useEffect(() => {
    if (window.electronAPI) {
      const unsub = window.electronAPI.onCommandPalette(() => {
        setCommandPaletteOpen(true);
      });
      return unsub;
    }
  }, [setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const baseCommands = [
    {
      id: 'create-task',
      label: 'Create New Issue (새 업무 등록)',
      category: 'Actions',
      icon: <Plus className="h-4 w-4 text-primary" />,
      shortcut: 'C',
      action: () => {
        setCommandPaletteOpen(false);
        setCreateTaskModalOpen(true);
      },
    },
    {
      id: 'record-meeting',
      label: 'Start Meeting Recording (회의 녹음 시작)',
      category: 'Actions',
      icon: <Video className="h-4 w-4 text-red-500" />,
      action: () => {
        setCommandPaletteOpen(false);
        setRecordMeetingModalOpen(true);
      },
    },
    {
      id: 'create-project',
      label: 'Create New Project (새 프로젝트 생성)',
      category: 'Actions',
      icon: <FolderKanban className="h-4 w-4 text-amber-500" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCreateProjectModalOpen(true);
      },
    },
    {
      id: 'create-team',
      label: 'Create New Team (새 팀 생성)',
      category: 'Actions',
      icon: <Users2 className="h-4 w-4 text-emerald-500" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCreateTeamModalOpen(true);
      },
    },
    {
      id: 'nav-dashboard',
      label: 'Open Dashboard (개인 대시보드 이동)',
      category: 'Navigation',
      icon: <LayoutDashboard className="h-4 w-4 text-text-muted" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCurrentProjectId(null);
        setCurrentView('dashboard');
      },
    },
    {
      id: 'nav-teams',
      label: 'View Teams (팀 & 스쿼드 관리 이동)',
      category: 'Navigation',
      icon: <Users2 className="h-4 w-4 text-text-muted" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCurrentProjectId(null);
        setCurrentView('teams');
      },
    },
    {
      id: 'nav-projects',
      label: 'View Projects (프로젝트 목록 이동)',
      category: 'Navigation',
      icon: <FolderKanban className="h-4 w-4 text-text-muted" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCurrentProjectId(null);
        setCurrentView('projects');
      },
    },
    {
      id: 'nav-tasks',
      label: 'View My Tasks (업무 관리 이동)',
      category: 'Navigation',
      icon: <CheckSquare className="h-4 w-4 text-text-muted" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCurrentProjectId(null);
        setCurrentView('tasks');
      },
    },
    {
      id: 'nav-meetings',
      label: 'Search Meetings (회의록 목록 이동)',
      category: 'Navigation',
      icon: <Video className="h-4 w-4 text-text-muted" />,
      action: () => {
        setCommandPaletteOpen(false);
        setCurrentProjectId(null);
        setCurrentView('meetings');
      },
    },
    {
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      category: 'Preferences',
      icon: theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-text-muted" />,
      action: () => {
        setCommandPaletteOpen(false);
        toggleTheme();
      },
    },
  ];

  // Dynamic project open commands
  const projectCommands = projects.map((p) => ({
    id: `project-${p.id}`,
    label: `Open Project: ${p.name}`,
    category: 'Projects',
    icon: <GitBranch className="h-4 w-4 text-primary" />,
    action: () => {
      setCommandPaletteOpen(false);
      setCurrentProjectId(p.id);
      setCurrentView('project-detail', p.id);
    },
  }));

  const allItems = [...baseCommands, ...projectCommands];

  const filteredItems = allItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDownInPalette = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="relative w-full max-w-xl rounded-xl border border-border bg-surface shadow-modal overflow-hidden animate-scale-in">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border h-12">
          <Search className="h-4 w-4 text-text-muted shrink-0 mr-2.5" />
          <input
            autoFocus
            type="text"
            placeholder="명령어 검색, 이동, 이슈 생성... (Esc 키로 닫기)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInPalette}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded border border-border bg-surface-hover">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              일치하는 명령어가 없습니다.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors text-xs ${
                    isSelected ? 'bg-primary-light text-primary font-medium' : 'text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted font-mono">{item.category}</span>
                    <ArrowRight className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/60 bg-surface-hover/50 flex items-center justify-between text-[11px] font-mono text-text-muted">
          <div className="flex items-center gap-2">
            <span>↑↓ 이동</span>
            <span>↵ 실행</span>
          </div>
          <span>FlowMate Command Palette</span>
        </div>
      </div>
    </div>
  );
};
