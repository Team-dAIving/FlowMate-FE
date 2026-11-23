import { create } from 'zustand';
import { Meeting, ActionItem } from '../types';
import { api } from '../services/api';

interface MeetingState {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  isLoading: boolean;
  isAnalyzing: boolean;

  fetchMeetings: (projectId?: string) => Promise<void>;
  fetchMeetingById: (id: string) => Promise<Meeting | undefined>;
  createMeeting: (data: Partial<Meeting>) => Promise<Meeting>;
  completeMeetingRecording: (meetingId: string, recording: Blob, durationSeconds: number) => Promise<Meeting>;
  analyzeMeeting: (meetingId: string) => Promise<Meeting>;
  approveActionItem: (
    meetingId: string,
    actionItemId: string,
    options: { createGitHubIssue: boolean; customData?: Partial<ActionItem> }
  ) => Promise<void>;
  rejectActionItem: (meetingId: string, actionItemId: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  isLoading: false,
  isAnalyzing: false,

  fetchMeetings: async (projectId?: string) => {
    set({ isLoading: true });
    try {
      const meetings = await api.getMeetings(projectId);
      set({ meetings, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
      set({ isLoading: false });
    }
  },

  fetchMeetingById: async (id: string) => {
    set({ isLoading: true });
    try {
      const meeting = await api.getMeetingById(id);
      set((state) => ({
        currentMeeting: meeting || null,
        meetings: meeting
          ? state.meetings.some((item) => item.id === meeting.id)
            ? state.meetings.map((item) =>
                item.id === meeting.id
                  ? { ...item, ...meeting, projectName: meeting.projectName || item.projectName }
                  : item
              )
            : [meeting, ...state.meetings]
          : state.meetings,
        isLoading: false,
      }));
      return meeting;
    } catch (err) {
      console.error('Failed to fetch meeting:', err);
      set({ isLoading: false });
      return undefined;
    }
  },

  createMeeting: async (data) => {
    const newMeeting = await api.createMeeting(data);
    set((state) => ({ meetings: [newMeeting, ...state.meetings.filter((item) => item.id !== newMeeting.id)] }));
    return newMeeting;
  },

  completeMeetingRecording: async (meetingId, recording, durationSeconds) => {
    const meeting = await api.completeMeetingRecording(meetingId, recording, durationSeconds);
    set((state) => ({
      currentMeeting: meeting,
      meetings: state.meetings.map((item) =>
        item.id === meetingId ? { ...item, ...meeting, projectName: meeting.projectName || item.projectName } : item
      ),
    }));
    return meeting;
  },

  analyzeMeeting: async (meetingId: string) => {
    set({ isAnalyzing: true });
    try {
      const analyzed = await api.analyzeMeeting(meetingId);
      set((state) => ({
        isAnalyzing: false,
        currentMeeting: state.currentMeeting?.id === meetingId ? analyzed : state.currentMeeting,
        meetings: state.meetings.map((m) => (m.id === meetingId ? analyzed : m)),
      }));
      return analyzed;
    } catch (err) {
      set({ isAnalyzing: false });
      throw err;
    }
  },

  approveActionItem: async (meetingId, actionItemId, options) => {
    await api.approveActionItem(meetingId, actionItemId, options);
    // Refresh current meeting
    await get().fetchMeetingById(meetingId);
    await get().fetchMeetings();
  },

  rejectActionItem: async (meetingId, actionItemId) => {
    await api.rejectActionItem(meetingId, actionItemId);
    await get().fetchMeetingById(meetingId);
    await get().fetchMeetings();
  },
}));
