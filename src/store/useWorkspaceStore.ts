import { create } from 'zustand';
import { Workspace, Project, User } from '../types';
import { api } from '../services/api';

export type AppView =
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'teams'
  | 'team-detail'
  | 'tasks'
  | 'meetings'
  | 'meeting-detail'
  | 'settings';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  projects: Project[];
  currentProjectId: string | null;
  currentView: AppView;
  selectedMeetingId: string | null;
  selectedTeamId: string | null;
  currentUser: User | null;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  setCurrentView: (view: AppView, contextId?: string) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  setSelectedTeamId: (teamId: string | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'progress'>) => Promise<Project>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  projects: [],
  currentProjectId: null,
  currentView: 'dashboard',
  selectedMeetingId: null,
  selectedTeamId: null,
  currentUser: null,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const [user, workspaces, projects] = await Promise.all([
        api.getCurrentUser(),
        api.getWorkspaces(),
        api.getProjects(),
      ]);
      set({
        currentUser: user,
        workspaces,
        currentWorkspace: workspaces[0] || null,
        projects,
        // Start outside any project (the app opens on the dashboard)
        currentProjectId: null,
        isLoading: false,
      });
    } catch (err) {
      console.error('Initialization error:', err);
      set({ isLoading: false });
    }
  },

  // currentProjectId means "inside this project". Leaving project-detail clears it, so e.g. the
  // all-issues page reached from the dashboard shows every project instead of the last one viewed.
  setCurrentView: (view: AppView, contextId?: string) => {
    if (view === 'project-detail') {
      set({ currentView: view, ...(contextId ? { currentProjectId: contextId } : {}) });
    } else if (view === 'meeting-detail' && contextId) {
      set({ currentView: view, selectedMeetingId: contextId, currentProjectId: null });
    } else if (view === 'team-detail' && contextId) {
      set({ currentView: view, selectedTeamId: contextId, currentProjectId: null });
    } else {
      set({ currentView: view, currentProjectId: null });
    }
  },

  setCurrentProjectId: (projectId: string | null) => {
    set({ currentProjectId: projectId });
  },

  setSelectedTeamId: (teamId: string | null) => {
    set({ selectedTeamId: teamId });
  },

  fetchProjects: async () => {
    const projects = await api.getProjects();
    set({ projects });
  },

  createProject: async (data) => {
    const newProj = await api.createProject(data);
    await get().fetchProjects();
    return newProj;
  },
}));
