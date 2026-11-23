import { create } from 'zustand';
import { CreateTeamInput, Team, TeamDetail } from '../types';
import { api } from '../services/api';

let detailRequestSequence = 0;

interface TeamState {
  teams: Team[];
  teamDetail: TeamDetail | null;
  currentTeamId: string | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  detailError: string | null;

  fetchTeams: () => Promise<void>;
  fetchTeamDetail: (id: string) => Promise<void>;
  clearTeamDetail: () => void;
  createTeam: (data: CreateTeamInput) => Promise<Team>;
  setCurrentTeamId: (id: string | null) => void;
  getTeamById: (id: string) => Team | undefined;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  teamDetail: null,
  currentTeamId: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,
  detailError: null,

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

  fetchTeamDetail: async (id) => {
    const requestId = ++detailRequestSequence;
    set({ teamDetail: null, isDetailLoading: true, detailError: null });
    try {
      const detail = await api.getTeamDetail(id);
      if (requestId !== detailRequestSequence) return;
      if (!detail) {
        set({ isDetailLoading: false, detailError: '팀을 찾을 수 없습니다.' });
        return;
      }
      set({ teamDetail: detail, isDetailLoading: false });
    } catch (err) {
      if (requestId !== detailRequestSequence) return;
      console.error('Failed to fetch team detail:', err);
      set({
        isDetailLoading: false,
        detailError: err instanceof Error && err.message ? err.message : '팀 상세를 불러오지 못했습니다.',
      });
    }
  },

  clearTeamDetail: () => {
    detailRequestSequence += 1;
    set({ teamDetail: null, isDetailLoading: false, detailError: null });
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
