import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import {
  FolderKanban,
  GitBranch,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  LayoutGrid,
  CalendarDays,
  Video,
  Users2,
  ArrowLeft,
  Plus,
  ExternalLink,
  Target,
  BarChart3,
  Layers,
  Crown,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useTeamStore } from '../../store/useTeamStore';
import { useUIStore } from '../../store/useUIStore';
import { Tabs } from '../ui/Tabs';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { TaskListView } from '../tasks/TaskListView';
import { TaskKanbanView } from '../tasks/TaskKanbanView';
import { TaskTimelineView } from '../tasks/TaskTimelineView';
import { formatDate } from '../../utils/formatters';
import { getProjectLeader } from '../../utils/projectLeader';
import { api } from '../../services/api';
import { ProjectIdeButtons } from './ProjectIdeButtons';

export const ProjectDetail: React.FC = () => {
  const { currentProjectId, projects, setCurrentView, fetchProjects } = useWorkspaceStore();
  const { tasks } = useTaskStore();
  const { meetings } = useMeetingStore();
  const { teams } = useTeamStore();
  const { setCreateTaskModalOpen, setRecordMeetingModalOpen, setSelectedTaskIdForDetail } = useUIStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'board' | 'timeline' | 'meetings' | 'members'>('overview');

  const project = projects.find((p) => p.id === currentProjectId) || projects[0];
  if (!project) return null;

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const projectMeetings = meetings.filter((m) => m.projectId === project.id);
  const connectedTeams = teams.filter((t) => (t.projectIds || []).includes(project.id));
  const leader = getProjectLeader(project);

  // Leader is a project-level setting: update leaderId and keep OWNER role in sync
  const handleChangeLeader = async (userId: string) => {
    try {
      await api.updateProject(project.id, {
        leaderId: userId,
        members: project.members.map((m) => ({
          ...m,
          role: m.user.id === userId ? 'OWNER' : m.role === 'OWNER' ? 'MEMBER' : m.role,
        })),
      });
      await fetchProjects();
    } catch (err) {
      console.error('Failed to change project leader:', err);
    }
  };

  // Task Status Distribution for this specific project
  const statusCounts = {
    TODO: projectTasks.filter((t) => t.status === 'TODO').length,
    IN_PROGRESS: projectTasks.filter((t) => t.status === 'IN_PROGRESS').length,
    IN_REVIEW: projectTasks.filter((t) => t.status === 'IN_REVIEW').length,
    DONE: projectTasks.filter((t) => t.status === 'DONE').length,
  };

  const statusPieData = [
    { name: 'TODO', value: statusCounts.TODO, color: '#94A3B8' },
    { name: 'IN PROGRESS', value: statusCounts.IN_PROGRESS, color: '#3B82F6' },
    { name: 'IN REVIEW', value: statusCounts.IN_REVIEW, color: '#F59E0B' },
    { name: 'DONE', value: statusCounts.DONE, color: '#10B981' },
  ];

  // Project Member Workload (Active vs Done for this project)
  const memberWorkloadData = project.members.map((member) => {
    const memberTasks = projectTasks.filter((t) => t.assignee?.id === member.user.id);
    const active = memberTasks.filter((t) => t.status !== 'DONE').length;
    const done = memberTasks.filter((t) => t.status === 'DONE').length;
    return {
      name: member.user.name,
      Active: active,
      Done: done,
    };
  });

  // Project Weekly Velocity
  const projectTrendData = [
    { day: '11.12', completed: 1, created: 2 },
    { day: '11.13', completed: 2, created: 1 },
    { day: '11.14', completed: 3, created: 3 },
    { day: '11.15', completed: 4, created: 2 },
    { day: '11.16', completed: 3, created: 1 },
    { day: '11.17', completed: 5, created: 4 },
    { day: '11.18', completed: statusCounts.DONE || 6, created: 2 },
  ];

  const totalTasks = projectTasks.length || 1;
  const calculatedProgress = Math.round((statusCounts.DONE / totalTasks) * 100);

  const tabs = [
    { id: 'overview', label: 'Overview & Dashboard', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'issues', label: 'Issues', icon: <ListTodo className="h-3.5 w-3.5" />, count: projectTasks.length },
    { id: 'board', label: 'Board', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: 'timeline', label: 'Timeline', icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: 'meetings', label: 'Meetings', icon: <Video className="h-3.5 w-3.5" />, count: projectMeetings.length },
    { id: 'members', label: 'Members', icon: <Users2 className="h-3.5 w-3.5" />, count: project.members.length },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <button
            onClick={() => setCurrentView('projects')}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>프로젝트 목록으로 돌아가기</span>
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              {project.name}
            </h1>
            <Badge variant="default" className="text-[10px] uppercase font-mono">
              {project.projectType}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            <span>리더: {leader ? leader.name : '미지정'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* key: this view stays mounted when switching projects; remount so the saved path is re-read */}
          <ProjectIdeButtons key={project.id} projectId={project.id} />
          {project.githubRepo && (
            <a
              href={project.githubRepo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-mono text-text-secondary hover:text-text-primary flex items-center gap-1.5 shadow-subtle transition-colors"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>{project.githubRepo.name}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

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

      {/* Tabs navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Tab 1: Overview & Project Analytics Dashboard */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Description & Goal */}
            <Card className="lg:col-span-2 p-4 space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                  프로젝트 목표 및 개요
                </h4>
                <p className="text-xs text-text-primary leading-relaxed">{project.description}</p>
              </div>

              <div className="p-3 rounded-lg bg-surface-hover border border-border/80 text-xs text-text-primary flex items-center gap-2">
                <Target className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium">최종 목표: {project.goal}</span>
              </div>

              {/* Connected Teams */}
              <div className="pt-1">
                <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>담당 참여 팀 (Connected Teams)</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {connectedTeams.length === 0 ? (
                    <span className="text-xs text-text-muted italic">지정된 팀 없음</span>
                  ) : (
                    connectedTeams.map((team) => (
                      <div
                        key={team.id}
                        onClick={() => setCurrentView('team-detail', team.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface-hover/70 hover:border-primary/50 cursor-pointer text-xs transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: team.color || '#4F46E5' }}
                        />
                        <span className="font-semibold text-text-primary">{team.name}</span>
                        <span className="text-text-muted text-[10px]">({team.memberCount}명)</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            {/* Progress & Deadlines */}
            <Card className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between font-semibold text-text-primary">
                <span>프로젝트 진척도</span>
                <span className="font-mono text-primary font-bold text-sm">{calculatedProgress}%</span>
              </div>
              <div className="w-full bg-border/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${calculatedProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-muted font-mono pt-1">
                <span>완료: {statusCounts.DONE}건</span>
                <span>총 업무: {projectTasks.length}건</span>
              </div>

              <div className="border-t border-border/60 pt-2 space-y-1.5 font-mono text-text-secondary text-[11px]">
                <div className="flex items-center justify-between">
                  <span>시작일</span>
                  <span className="text-text-primary">{formatDate(project.startDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>종료 예정일</span>
                  <span className="text-text-primary">{formatDate(project.endDate)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* PROJECT DASHBOARD CHARTS (Merged from Team Dashboard per user request!) */}
          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-text-muted tracking-wider uppercase flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>PROJECT DASHBOARD & METRICS ({project.name})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Chart 1: Donut Chart (Status distribution for this project) */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xs flex items-center justify-between w-full">
                    <span>이슈 상태별 분포 (Status)</span>
                    <span className="font-mono text-[11px] text-text-muted">총 {projectTasks.length}건</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center pt-2">
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-surface)',
                            borderColor: 'var(--color-border)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full pt-2 border-t border-border/50 text-[11px]">
                    {statusPieData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-text-secondary">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-text-primary">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Chart 2: Project Member Workload Distribution */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xs flex items-center justify-between w-full">
                    <span>프로젝트 참여자별 업무량 (Workload)</span>
                    <span className="text-[11px] text-text-muted font-normal">Active vs Done</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pt-2">
                  <div className="w-full h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={memberWorkloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-surface)',
                            borderColor: 'var(--color-border)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="Active" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Done" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Chart 3: Weekly Task Velocity */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xs flex items-center justify-between w-full">
                    <span>주간 작업 완료 추이 (Velocity)</span>
                    <span className="text-[11px] text-text-muted font-normal">최근 7일</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pt-2">
                  <div className="w-full h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projectTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorProjectVelocity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-surface)',
                            borderColor: 'var(--color-border)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stroke="#4F46E5"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorProjectVelocity)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Issues Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
              <span>최근 등록된 프로젝트 이슈</span>
              <button
                onClick={() => setActiveTab('issues')}
                className="text-primary hover:underline text-[11px]"
              >
                전체 이슈 보기 ({projectTasks.length}건)
              </button>
            </div>
            <TaskListView tasks={projectTasks.slice(0, 4)} onSelectTask={setSelectedTaskIdForDetail} />
          </div>
        </div>
      )}

      {/* Tab 2: Issues (List View) */}
      {activeTab === 'issues' && (
        <TaskListView tasks={projectTasks} onSelectTask={setSelectedTaskIdForDetail} />
      )}

      {/* Tab 3: Board (Kanban) */}
      {activeTab === 'board' && (
        <TaskKanbanView tasks={projectTasks} onSelectTask={setSelectedTaskIdForDetail} />
      )}

      {/* Tab 4: Timeline */}
      {activeTab === 'timeline' && (
        <TaskTimelineView tasks={projectTasks} onSelectTask={setSelectedTaskIdForDetail} />
      )}

      {/* Tab 5: Meetings */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">이 프로젝트와 연결된 회의록</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRecordMeetingModalOpen(true)}
              className="text-xs gap-1"
            >
              <Video className="h-3 w-3 text-red-500" />
              <span>새 회의 녹음</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectMeetings.map((m) => (
              <Card
                key={m.id}
                hoverEffect
                onClick={() => setCurrentView('meeting-detail', m.id)}
                className="p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-primary truncate">{m.title}</h4>
                  <Badge variant="status" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    AI 분석 완료
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                  {m.summary}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] font-mono text-text-muted">
                  <span>{formatDate(m.meetingDate)}</span>
                  <span>Action Items: {m.actionItems?.length || 0}건</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Members */}
      {activeTab === 'members' && (
        <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle max-w-2xl">
          <div className="p-3 bg-surface-hover/50 text-[11px] font-mono font-semibold text-text-muted flex items-center justify-between">
            <span>MEMBER</span>
            <span>ROLE & ACCESS</span>
          </div>
          {project.members.map((m) => (
            <div key={m.user.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={m.user.avatarUrl} name={m.user.name} size="sm" />
                <div>
                  <div className="text-xs font-semibold text-text-primary">{m.user.name}</div>
                  <div className="text-[11px] text-text-muted">{m.user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.user.id === leader?.id ? (
                  <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    리더
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleChangeLeader(m.user.id)}
                    className="text-[10px] text-text-muted hover:text-primary hover:underline"
                  >
                    리더로 지정
                  </button>
                )}
                <Badge variant="default" className="text-[10px] font-mono uppercase">
                  {m.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
