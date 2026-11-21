import React from 'react';
import {
  List,
  LayoutGrid,
  CalendarDays,
  Plus,
  Search,
  Filter,
} from 'lucide-react';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { TaskListView } from './TaskListView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskTimelineView } from './TaskTimelineView';
import { Button } from '../ui/Button';
import { getCollaboratorUsers, getProjectMemberUsers } from '../../utils/projectMembers';
import { TaskStatus, TaskPriority } from '../../types';

export const TasksView: React.FC = () => {
  const {
    tasks,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
  } = useTaskStore();

  const { setCreateTaskModalOpen, setSelectedTaskIdForDetail } = useUIStore();
  const { currentProjectId, projects, currentUser } = useWorkspaceStore();

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const assigneeFilterOptions = currentProject
    ? getProjectMemberUsers(currentProject, currentUser)
    : getCollaboratorUsers(projects, currentUser);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (currentProjectId && t.projectId !== currentProjectId) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (assigneeFilter !== 'ALL' && t.assignee?.id !== assigneeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      return matchTitle || matchDesc;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="text-xs font-mono text-text-muted">
            {currentProject ? `~/projects/${currentProject.name}/issues` : '~/workspace/all-issues'}
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1">
            {currentProject ? `${currentProject.name} 업무 목록` : '전체 업무 관리 (All Issues)'}
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            팀원들의 작업 진행 상태를 확인하고 우선순위와 일정을 조율합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 shadow-subtle">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-primary text-white font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="칸반 보드 보기"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">보드</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-white font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="리스트 목록 보기"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">목록</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-primary text-white font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="타임라인 일정 보기"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">타임라인</span>
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => setCreateTaskModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>새 업무</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-2.5 rounded-lg border border-border shadow-subtle">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="업무 검색 (제목, 내용)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs w-full rounded-md border border-border bg-surface-hover/30 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'ALL')}
            className="h-8 px-2.5 rounded-md border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">전체 상태</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="DONE">DONE</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'ALL')}
            className="h-8 px-2.5 rounded-md border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">전체 우선순위</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>

          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">전체 담당자</option>
            {assigneeFilterOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Render Selected View */}
      {viewMode === 'kanban' && (
        <TaskKanbanView tasks={filteredTasks} onSelectTask={setSelectedTaskIdForDetail} />
      )}
      {viewMode === 'list' && (
        <TaskListView tasks={filteredTasks} onSelectTask={setSelectedTaskIdForDetail} />
      )}
      {viewMode === 'timeline' && (
        <TaskTimelineView tasks={filteredTasks} onSelectTask={setSelectedTaskIdForDetail} />
      )}
    </div>
  );
};
