import { useMeetingStore } from './useMeetingStore';
import { useTaskStore } from './useTaskStore';
import { useTeamStore } from './useTeamStore';
import { useUIStore } from './useUIStore';
import { useWorkspaceStore } from './useWorkspaceStore';

/**
 * Forget everything loaded for the signed-in user (logout or session rejected), so the next account
 * never sees the previous one's teams, profile or open screens, even for a moment.
 * Theme and other device preferences are kept.
 */
export function resetSessionData(): void {
  useTeamStore.setState({ teams: [], currentTeamId: null, isLoading: false, error: null });
  useWorkspaceStore.setState({
    currentUser: null,
    workspaces: [],
    currentWorkspace: null,
    projects: [],
    currentProjectId: null,
    selectedTeamId: null,
    selectedMeetingId: null,
    currentView: 'dashboard',
  });
  useTaskStore.setState({ tasks: [], searchQuery: '', statusFilter: 'ALL', priorityFilter: 'ALL', assigneeFilter: 'ALL' });
  useMeetingStore.setState({ meetings: [], currentMeeting: null });
  useUIStore.setState({
    notifications: [],
    unreadCount: 0,
    selectedTaskIdForDetail: null,
    isCreateTaskModalOpen: false,
    isCreateProjectModalOpen: false,
    isCreateTeamModalOpen: false,
    isRecordMeetingModalOpen: false,
    isCommandPaletteOpen: false,
    isNotificationPanelOpen: false,
  });
}
