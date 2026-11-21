import React, { useEffect } from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { PersonalDashboard } from '../dashboard/PersonalDashboard';
import { ProjectList } from '../projects/ProjectList';
import { ProjectDetail } from '../projects/ProjectDetail';
import { TeamList } from '../teams/TeamList';
import { TeamDetail } from '../teams/TeamDetail';
import { TasksView } from '../tasks/TasksView';
import { MeetingList } from '../meetings/MeetingList';
import { MeetingDetail } from '../meetings/MeetingDetail';

// Modals
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { ProjectCreateModal } from '../projects/ProjectCreateModal';
import { TeamCreateModal } from '../teams/TeamCreateModal';
import { AudioRecorderModal } from '../meetings/AudioRecorderModal';
import { CommandPalette } from '../command-palette/CommandPalette';
import { NotificationPanel } from '../notifications/NotificationPanel';

import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useTeamStore } from '../../store/useTeamStore';
import { useUIStore } from '../../store/useUIStore';

export const AppLayout: React.FC = () => {
  const { currentView, initialize } = useWorkspaceStore();
  const { fetchTasks } = useTaskStore();
  const { fetchMeetings } = useMeetingStore();
  const { fetchTeams } = useTeamStore();
  const {
    isCreateTaskModalOpen,
    setCreateTaskModalOpen,
    isCreateProjectModalOpen,
    createProjectDefaultTeamId,
    setCreateProjectModalOpen,
    isCreateTeamModalOpen,
    setCreateTeamModalOpen,
    isRecordMeetingModalOpen,
    setRecordMeetingModalOpen,
    selectedTaskIdForDetail,
    setSelectedTaskIdForDetail,
    fetchNotifications,
  } = useUIStore();

  useEffect(() => {
    initialize();
    fetchTasks();
    fetchMeetings();
    fetchTeams();
    fetchNotifications();
  }, [initialize, fetchTasks, fetchMeetings, fetchTeams, fetchNotifications]);

  const renderMainView = () => {
    switch (currentView) {
      case 'dashboard':
        return <PersonalDashboard />;
      case 'projects':
        return <ProjectList />;
      case 'project-detail':
        return <ProjectDetail />;
      case 'teams':
        return <TeamList />;
      case 'team-detail':
        return <TeamDetail />;
      case 'tasks':
        return <TasksView />;
      case 'meetings':
        return <MeetingList />;
      case 'meeting-detail':
        return <MeetingDetail />;
      default:
        return <PersonalDashboard />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text-primary selection:bg-primary-light selection:text-primary">
      {/* 1. Desktop TitleBar */}
      <TitleBar />

      {/* 2. Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Center Content View Area */}
        <main className="flex-1 overflow-y-auto bg-background/50">
          {renderMainView()}
        </main>
      </div>

      {/* Global Modals & Palettes */}
      <TaskCreateModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setCreateTaskModalOpen(false)}
      />

      <TaskDetailModal
        taskId={selectedTaskIdForDetail}
        onClose={() => setSelectedTaskIdForDetail(null)}
      />

      <ProjectCreateModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setCreateProjectModalOpen(false)}
        defaultTeamId={createProjectDefaultTeamId ?? undefined}
      />

      <TeamCreateModal
        isOpen={isCreateTeamModalOpen}
        onClose={() => setCreateTeamModalOpen(false)}
      />

      <AudioRecorderModal
        isOpen={isRecordMeetingModalOpen}
        onClose={() => setRecordMeetingModalOpen(false)}
      />

      <CommandPalette />
      <NotificationPanel />
    </div>
  );
};
