import { create } from 'zustand';
import { Team } from '../types';
import { api } from '../services/api';

interface TeamState {
  teams: Team[];
  currentTeamId: string | null;
  isLoading: boolean;

  fetchTeams: () => Promise<void>;
  createTeam: (data: Omit<Team, 'id' | 'createdAt' | 'members' | 'projects'>) => Promise<Team>;
  setCurrentTeamId: (id: string | null) => void;
  getTeamById: (id: string) => Team | undefined;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  currentTeamId: null,
  isLoading: false,

  fetchTeams: async () => {
    set({ isLoading: true });
    try {
      const teams = await api.getTeams();
      set({ teams, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      set({ isLoading: false });
    }
  },

  createTeam: async (data) => {
    const newTeam = await api.createTeam(data);
    await get().fetchTeams();
    return newTeam;
  },

  setCurrentTeamId: (id) => set({ currentTeamId: id }),

  getTeamById: (id) => {
    return get().teams.find((t) => t.id === id);
  },
}));
