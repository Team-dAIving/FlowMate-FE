import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Video,
  Users2,
  ListTodo,
  Plus,
  GitBranch,
  Sparkles,
  Layers,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { USE_REAL_API } from '../../services/http';
import { useWorkspaceStore, AppView } from '../../store/useWorkspaceStore';
import { useTeamStore } from '../../store/useTeamStore';
import { useUIStore } from '../../store/useUIStore';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    projects,
    currentProjectId,
    setCurrentProjectId,
    setSelectedTeamId,
    currentUser,
  } = useWorkspaceStore();

  const { teams } = useTeamStore();
  const logout = useAuthStore((s) => s.logout);
  const { setCreateTaskModalOpen, setCreateProjectModalOpen, setCreateTeamModalOpen } = useUIStore();

  const navItems: { view: AppView; label: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { view: 'projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
    { view: 'teams', label: 'Teams', icon: <Users2 className="h-4 w-4" /> },
    { view: 'tasks', label: 'All Issues', icon: <ListTodo className="h-4 w-4" /> },
    { view: 'meetings', label: 'Meetings', icon: <Video className="h-4 w-4" /> },
  ];

  return (
    <aside className="w-60 bg-sidebar border-r border-border flex flex-col justify-between shrink-0 select-none text-text-primary h-[calc(100vh-40px)]">
      {/* Top action: Quick Create Task */}
      <div className="p-3">
        <button
          onClick={() => setCreateTaskModalOpen(true)}
          className="w-full h-8 px-3 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-medium flex items-center justify-between shadow-subtle transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>새 업무 등록</span>
          </div>
          <span className="font-mono text-[10px] bg-white/20 px-1 py-0.5 rounded">C</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 space-y-5">
        {/* Workspace section */}
        <div>
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            Workspace
          </div>
          <div className="mt-1 space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                (currentView === item.view || (item.view === 'teams' && currentView === 'team-detail')) &&
                !currentProjectId;

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setCurrentProjectId(null);
                    setCurrentView(item.view);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left',
                    isActive
                      ? 'bg-primary-light text-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  )}
                >
                  <span className={cn(isActive ? 'text-primary' : 'text-text-muted')}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Teams List section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Teams
            </span>
            <button
              onClick={() => setCreateTeamModalOpen(true)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-surface-hover"
              title="새 팀 생성"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-1 space-y-0.5">
            {teams.map((team) => {
              const isSelected = currentView === 'team-detail' && useWorkspaceStore.getState().selectedTeamId === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => {
                    setCurrentProjectId(null);
                    setSelectedTeamId(team.id);
                    setCurrentView('team-detail', team.id);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left group',
                    isSelected
                      ? 'bg-primary-light text-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: team.color || '#4F46E5' }}
                    />
                    <span className="truncate">{team.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted opacity-60 group-hover:opacity-100">
                    {team.memberCount}명
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Projects List section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Projects
            </span>
            <button
              onClick={() => setCreateProjectModalOpen(true)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-surface-hover"
              title="프로젝트 추가"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-1 space-y-0.5">
            {projects.map((proj) => {
              const isSelected = currentView === 'project-detail' && currentProjectId === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => {
                    setCurrentProjectId(proj.id);
                    setCurrentView('project-detail', proj.id);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left group',
                    isSelected
                      ? 'bg-primary-light text-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{proj.name}</span>
                  </div>
                  {(proj.repositories || []).length > 0 && (
                    <GitBranch className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Assistant Banner */}
        <div className="p-2.5 rounded-lg border border-primary/20 bg-primary-light/50 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Meeting Flow</span>
          </div>
          <p className="text-[11px] text-text-secondary leading-snug">
            회의 음성을 녹음하면 AI가 안건과 Action Items를 자동 추출하고 승인할 수 있습니다.
          </p>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-border bg-surface-hover/30">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setCurrentProjectId(null);
              setCurrentView('mypage');
            }}
            title="마이페이지"
            aria-current={currentView === 'mypage' ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 min-w-0 flex-1 text-left rounded-md -m-1 p-1 transition-colors',
              currentView === 'mypage' ? 'bg-primary-light/60' : 'hover:bg-surface-hover'
            )}
          >
            <Avatar src={currentUser?.avatarUrl} name={currentUser?.name} size="sm" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-primary truncate">
                {currentUser?.name || '사용자'}
              </div>
              <div className="text-[10px] text-text-muted truncate">
                {currentUser?.githubLogin ? `@${currentUser.githubLogin}` : currentUser?.department || '마이페이지'}
              </div>
            </div>
          </button>
          {USE_REAL_API ? (
            <button
              type="button"
              onClick={() => logout()}
              title="로그아웃"
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Badge variant="default" className="text-[9px] px-1 py-0 uppercase">
              {currentUser?.role || 'MEMBER'}
            </Badge>
          )}
        </div>
      </div>
    </aside>
  );
};
