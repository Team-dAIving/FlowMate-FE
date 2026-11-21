import { create } from 'zustand';
import { Notification } from '../types';
import { api } from '../services/api';

interface UIState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Modals & Panels
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  isCreateTaskModalOpen: boolean;
  setCreateTaskModalOpen: (open: boolean) => void;

  isCreateProjectModalOpen: boolean;
  createProjectDefaultTeamId: string | null; // 팀 상세에서 열면 해당 팀이 미리 선택됨
  setCreateProjectModalOpen: (open: boolean, defaultTeamId?: string) => void;

  isCreateTeamModalOpen: boolean;
  setCreateTeamModalOpen: (open: boolean) => void;

  isRecordMeetingModalOpen: boolean;
  setRecordMeetingModalOpen: (open: boolean) => void;

  selectedTaskIdForDetail: string | null;
  setSelectedTaskIdForDetail: (id: string | null) => void;

  isNotificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;

  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useUIStore = create<UIState>((set, get) => {
  // Read saved theme
  const savedTheme = (localStorage.getItem('flowmate_theme') as 'light' | 'dark') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return {
    theme: savedTheme,
    toggleTheme: () => {
      const nextTheme = get().theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('flowmate_theme', nextTheme);
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      set({ theme: nextTheme });
    },
    setTheme: (theme) => {
      localStorage.setItem('flowmate_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      set({ theme });
    },

    isCommandPaletteOpen: false,
    setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

    isCreateTaskModalOpen: false,
    setCreateTaskModalOpen: (open) => set({ isCreateTaskModalOpen: open }),

    isCreateProjectModalOpen: false,
    createProjectDefaultTeamId: null,
    setCreateProjectModalOpen: (open, defaultTeamId) =>
      set({ isCreateProjectModalOpen: open, createProjectDefaultTeamId: open ? defaultTeamId ?? null : null }),

    isCreateTeamModalOpen: false,
    setCreateTeamModalOpen: (open) => set({ isCreateTeamModalOpen: open }),

    isRecordMeetingModalOpen: false,
    setRecordMeetingModalOpen: (open) => set({ isRecordMeetingModalOpen: open }),

    selectedTaskIdForDetail: null,
    setSelectedTaskIdForDetail: (id) => set({ selectedTaskIdForDetail: id }),

    isNotificationPanelOpen: false,
    setNotificationPanelOpen: (open) => set({ isNotificationPanelOpen: open }),

    notifications: [],
    unreadCount: 0,

    fetchNotifications: async () => {
      const notifs = await api.getNotifications();
      const unread = notifs.filter((n) => !n.read).length;
      set({ notifications: notifs, unreadCount: unread });
    },

    markAsRead: async (id) => {
      await api.markNotificationAsRead(id);
      await get().fetchNotifications();
    },

    markAllAsRead: async () => {
      await api.markAllNotificationsAsRead();
      await get().fetchNotifications();
    },
  };
});
