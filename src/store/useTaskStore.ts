import { create } from 'zustand';
import { Task, TaskStatus, TaskPriority } from '../types';
import { api } from '../services/api';

export type TaskViewMode = 'list' | 'kanban' | 'timeline';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  viewMode: TaskViewMode;
  searchQuery: string;
  statusFilter: TaskStatus | 'ALL';
  priorityFilter: TaskPriority | 'ALL';
  assigneeFilter: string | 'ALL';

  // Actions
  fetchTasks: (projectId?: string) => Promise<void>;
  setViewMode: (mode: TaskViewMode) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: TaskStatus | 'ALL') => void;
  setPriorityFilter: (priority: TaskPriority | 'ALL') => void;
  setAssigneeFilter: (assigneeId: string | 'ALL') => void;
  createTask: (data: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<Task>;
  createGitHubIssue: (taskId: string) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  /** Loads the full task (description, dates, hours, comments, GitHub) into the list. */
  fetchTaskDetail: (id: string) => Promise<Task>;
  addComment: (taskId: string, content: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  viewMode: 'kanban',
  searchQuery: '',
  statusFilter: 'ALL',
  priorityFilter: 'ALL',
  assigneeFilter: 'ALL',

  fetchTasks: async (projectId?: string) => {
    set({ isLoading: true });
    try {
      const tasks = await api.getTasks(projectId);
      set({ tasks, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      set({ isLoading: false });
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setPriorityFilter: (priority) => set({ priorityFilter: priority }),
  setAssigneeFilter: (assigneeId) => set({ assigneeFilter: assigneeId }),

  createTask: async (data) => {
    const newTask = await api.createTask(data);
    await get().fetchTasks();
    return newTask;
  },

  updateTask: async (id, data) => {
    const updated = await api.updateTask(id, data);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
    return updated;
  },

  updateTaskStatus: async (id, status) => {
    const updated = await api.updateTask(id, { status });
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
    return updated;
  },

  createGitHubIssue: async (taskId) => {
    const updated = await api.createGitHubIssue(taskId);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
    }));
    return updated;
  },

  deleteTask: async (id) => {
    await api.deleteTask(id);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  fetchTaskDetail: async (id) => {
    const detail = await api.getTaskDetail(id);
    // List items (real mode) are summaries; keep what the list knew if the detail lacks it
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...detail, projectName: detail.projectName ?? t.projectName } : t)),
    }));
    return detail;
  },

  addComment: async (taskId, content) => {
    const comment = await api.addTaskComment(taskId, content);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t)),
    }));
  },
}));
