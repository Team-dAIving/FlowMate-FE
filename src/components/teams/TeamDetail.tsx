import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useTeamStore } from '../../store/useTeamStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useUIStore } from '../../store/useUIStore';
import { Tabs } from '../ui/Tabs';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { TaskListView } from '../tasks/TaskListView';

export const TeamDetail: React.FC = () => {
  const {
    teamDetail,
    detailError,
    fetchTeamDetail,
    clearTeamDetail,
  } = useTeamStore();
  const { selectedTeamId, setCurrentView, setCurrentProjectId } = useWorkspaceStore();
  const { setSelectedTaskIdForDetail, setCreateProjectModalOpen } = useUIStore();

  const [activeTab, setActiveTab] = useState<'projects' | 'members' | 'tasks'>('projects');
  const hasSelectedDetail = teamDetail?.id === selectedTeamId;

  useEffect(() => {
    setActiveTab('projects');
    if (selectedTeamId) void fetchTeamDetail(selectedTeamId);
    else clearTeamDetail();
    return clearTeamDetail;
  }, [selectedTeamId, fetchTeamDetail, clearTeamDetail]);

  if (selectedTeamId && !hasSelectedDetail && !detailError) {
    return (
      <div className="p-12 max-w-6xl mx-auto flex items-center justify-center gap-2 text-xs text-text-muted">
        <RefreshCw className="h-4 w-4 animate-spin" />
        팀 상세 정보를 불러오는 중입니다.
      </div>
    );
  }

  if (detailError && !teamDetail) {
    return (
      <div className="p-12 max-w-6xl mx-auto text-center space-y-3">
        <p role="alert" className="text-xs text-red-500">{detailError}</p>
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCurrentView('teams')}>팀 목록으로</Button>
          {selectedTeamId && (
            <Button size="sm" onClick={() => void fetchTeamDetail(selectedTeamId)}>다시 시도</Button>
          )}
        </div>
      </div>
    );
  }

  // Never keep showing the previous team's response while navigation is changing.
  const team = hasSelectedDetail ? teamDetail : null;
  if (!team) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-xs text-text-muted">
        팀을 찾을 수 없습니다.{' '}
        <button onClick={() => setCurrentView('teams')} className="text-primary underline">
          팀 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'projects', label: '팀 프로젝트 (Projects)', count: team.projectCount },
    { id: 'members', label: '팀원 (Members)', count: team.memberCount },
    { id: 'tasks', label: '팀 업무 현황 (Team Tasks)', count: team.taskCount },
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
              <span className="font-bold text-blue-600 text-sm">{team.inProgressTaskCount}건</span>
            </div>
            <div className="p-2 px-3 rounded-lg border border-border bg-surface text-center">
              <span className="text-text-muted block text-[10px]">완료 업무</span>
              <span className="font-bold text-emerald-600 text-sm">{team.completedTaskCount}건</span>
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
              {team.projects.map((project) => (
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
                      <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                        {project.name}
                      </h4>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {project.description && (
                    <p className="text-xs text-text-secondary line-clamp-2">{project.description}</p>
                  )}

                  {/* Progress */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-text-muted">프로젝트 전체 진행률</span>
                      <span className="font-bold text-text-primary">{project.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pt-2 border-t border-border/50">
                    <span>전체 업무: {project.totalTaskCount}건</span>
                    <span className="text-emerald-600">완료: {project.completedTaskCount}건</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Members */}
      {activeTab === 'members' && (
        <div className="border border-border rounded-lg bg-surface divide-y divide-border/60 overflow-hidden shadow-subtle max-w-3xl">
          <div className="p-3 bg-surface-hover/50 text-[11px] font-mono font-semibold text-text-muted flex items-center justify-between">
            <span>MEMBER</span>
            <span>ASSIGNED TASKS</span>
          </div>

          {team.members.map((member) => (
            <div key={member.id} className="p-3.5 flex items-center justify-between hover:bg-surface-hover/40 transition-colors">
              <div className="flex items-center gap-3">
                <Avatar src={member.avatarUrl} name={member.name} size="md" />
                <div>
                  <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <span>{member.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-text-secondary">
                  진행 중: <strong className="text-blue-600 font-bold">{member.inProgressAssignedTaskCount}</strong> / 전체 {member.totalAssignedTaskCount}건
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Team Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <div className="text-xs text-text-secondary">
            {team.name} 소속 멤버들에게 할당된 모든 프로젝트의 업무 목록입니다.
          </div>
          <TaskListView tasks={team.tasks} onSelectTask={setSelectedTaskIdForDetail} />
        </div>
      )}
    </div>
  );
};

