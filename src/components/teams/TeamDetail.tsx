import React, { useState } from 'react';
import {
  Users2,
  FolderKanban,
  CheckSquare,
  ArrowLeft,
  Calendar,
  ArrowUpRight,
  GitBranch,
  Plus,
} from 'lucide-react';
import { useTeamStore } from '../../store/useTeamStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';
import { Tabs } from '../ui/Tabs';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { TaskListView } from '../tasks/TaskListView';
import { formatDate } from '../../utils/formatters';

export const TeamDetail: React.FC = () => {
  const { teams } = useTeamStore();
  const { selectedTeamId, setCurrentView, setCurrentProjectId } = useWorkspaceStore();
  const { tasks } = useTaskStore();
  const { setSelectedTaskIdForDetail, setCreateProjectModalOpen } = useUIStore();

  const [activeTab, setActiveTab] = useState<'projects' | 'members' | 'tasks'>('projects');

  const team = teams.find((t) => t.id === selectedTeamId) || teams[0];
  if (!team) return null;

  // Tasks assigned to this team's members
  const memberIdSet = new Set(team.memberIds || []);
  const teamTasks = tasks.filter((t) => t.assignee && memberIdSet.has(t.assignee.id));
  const doneTasks = teamTasks.filter((t) => t.status === 'DONE');
  const activeTasks = teamTasks.filter((t) => t.status !== 'DONE');

  const tabs = [
    { id: 'projects', label: '담당 프로젝트 (Projects)', count: team.projects?.length || 0 },
    { id: 'members', label: '소속 팀원 (Members)', count: team.members.length },
    { id: 'tasks', label: '팀 업무 현황 (Team Tasks)', count: teamTasks.length },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="space-y-2">
        <button
          onClick={() => setCurrentView('teams')}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>팀 목록으로 돌아가기</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: team.color || '#4F46E5' }}
              />
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                {team.name}
              </h1>
            </div>
            <p className="text-xs text-text-secondary">{team.description}</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="p-2 px-3 rounded-lg border border-border bg-surface text-center">
              <span className="text-text-muted block text-[10px]">진행 업무</span>
              <span className="font-bold text-blue-600 text-sm">{activeTasks.length}건</span>
            </div>
            <div className="p-2 px-3 rounded-lg border border-border bg-surface text-center">
              <span className="text-text-muted block text-[10px]">완료 업무</span>
              <span className="font-bold text-emerald-600 text-sm">{doneTasks.length}건</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Tab 1: Connected Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-secondary">
              {team.name}이 현재 책임을 맡고 있는 프로젝트 목록입니다.
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateProjectModalOpen(true, team.id)}
              className="text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>이 팀으로 새 프로젝트 생성</span>
            </Button>
          </div>

          {(team.projects || []).length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-lg bg-surface/50 text-xs text-text-muted">
              연결된 프로젝트가 없습니다.
              <div className="mt-2 text-[11px]">위의 버튼으로 이 팀의 첫 번째 프로젝트를 생성하세요.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.projects?.map((project) => {
                const projTasks = tasks.filter((t) => t.projectId === project.id);
                const projTeamTasks = projTasks.filter(
                  (t) => t.assignee && memberIdSet.has(t.assignee.id)
                );

                return (
                  <Card
                    key={project.id}
                    hoverEffect
                    onClick={() => {
                      setCurrentProjectId(project.id);
                      setCurrentView('project-detail', project.id);
                    }}
                    className="p-4 space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary-light text-primary">
                          {project.key}
                        </span>
                        <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                          {project.name}
                        </h4>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <p className="text-xs text-text-secondary line-clamp-2">
                      {project.description}
                    </p>

                    {/* Progress */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-text-muted">프로젝트 전체 진행률</span>
                        <span className="font-bold text-text-primary">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pt-2 border-t border-border/50">
                      <span>우리 팀 담당 업무: {projTeamTasks.length}건</span>
                      {project.githubRepo && (
                        <span className="flex items-center gap-1 text-text-secondary">
                          <GitBranch className="h-3 w-3" />
                          <span>{project.githubRepo.name}</span>
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Members */}
      {activeTab === 'members' && (
        <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle max-w-3xl">
          <div className="p-3 bg-surface-hover/50 text-[11px] font-mono font-semibold text-text-muted flex items-center justify-between">
            <span>MEMBER</span>
            <span>ASSIGNED TASKS & ROLE</span>
          </div>

          {team.members.map((member) => {
            const memberTasks = tasks.filter((t) => t.assignee?.id === member.id);
            const inProgressCount = memberTasks.filter((t) => t.status === 'IN_PROGRESS').length;

            return (
              <div key={member.id} className="p-3.5 flex items-center justify-between hover:bg-surface-hover/40 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar src={member.avatarUrl} name={member.name} size="md" />
                  <div>
                    <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <span>{member.name}</span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {member.department} · {member.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-text-secondary">
                    진행 중: <strong className="text-blue-600 font-bold">{inProgressCount}</strong> / 전체 {memberTasks.length}건
                  </span>
                  <Badge variant="default" className="text-[10px] uppercase">
                    {member.role}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Team Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <div className="text-xs text-text-secondary">
            {team.name} 소속 멤버들에게 할당된 모든 프로젝트의 업무 목록입니다.
          </div>
          <TaskListView tasks={teamTasks} onSelectTask={setSelectedTaskIdForDetail} />
        </div>
      )}
    </div>
  );
};

