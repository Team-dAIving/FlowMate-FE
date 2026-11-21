import { create } from 'zustand';
import { CreateTeamInput, Team } from '../types';
import { api } from '../services/api';

interface TeamState {
  teams: Team[];
  currentTeamId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchTeams: () => Promise<void>;
  createTeam: (data: CreateTeamInput) => Promise<Team>;
  setCurrentTeamId: (id: string | null) => void;
  getTeamById: (id: string) => Team | undefined;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  currentTeamId: null,
  isLoading: false,
  error: null,

  fetchTeams: async () => {
    set({ isLoading: true, error: null });
    try {
      const teams = await api.getTeams();
      set({ teams, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : '팀 목록을 불러오지 못했습니다.',
      });
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
