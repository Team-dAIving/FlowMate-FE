import React from 'react';
import { Users2, Plus, ArrowUpRight, FolderKanban, CheckSquare } from 'lucide-react';
import { useTeamStore } from '../../store/useTeamStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export const TeamList: React.FC = () => {
  const { teams } = useTeamStore();
  const { setCurrentView, setSelectedTeamId } = useWorkspaceStore();
  const { tasks } = useTaskStore();
  const { setCreateTeamModalOpen } = useUIStore();

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setCurrentView('team-detail', teamId);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="text-xs font-mono text-text-muted">~/workspace/teams</div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1 flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            <span>팀 관리 (Teams & Squads)</span>
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            개발 조직의 각 팀과 역할, 담당하고 있는 프로젝트 및 소속 팀원을 유기적으로 관리합니다.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateTeamModalOpen(true)}
          className="text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>새 팀 생성</span>
        </Button>
      </div>

      {/* Grid of Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((team) => {
          // Calculate tasks belonging to this team's members
          const memberIdSet = new Set(team.memberIds || []);
          const teamTasks = tasks.filter((t) => t.assignee && memberIdSet.has(t.assignee.id));
          const activeCount = teamTasks.filter((t) => t.status !== 'DONE').length;

          return (
            <Card
              key={team.id}
              hoverEffect
              onClick={() => handleSelectTeam(team.id)}
              className="p-5 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Top: Color bar & member count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: team.color || '#4F46E5' }}
                    />
                    <span className="text-xs font-mono font-semibold text-text-muted">
                      {team.members.length}명 소속
                    </span>
                  </div>
                </div>

                {/* Team Name & Description */}
                <div>
                  <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>{team.name}</span>
                    <ArrowUpRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                    {team.description}
                  </p>
                </div>

                {/* Connected Projects Badges */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
                    담당 프로젝트 ({team.projects?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(team.projects || []).length === 0 ? (
                      <span className="text-[11px] text-text-muted italic">연결된 프로젝트 없음</span>
                    ) : (
                      team.projects?.map((proj) => (
                        <span
                          key={proj.id}
                          className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-hover border border-border text-text-primary font-medium flex items-center gap-1"
                        >
                          <FolderKanban className="h-3 w-3 text-primary" />
                          <span>[{proj.key}] {proj.name}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom: Member Avatars & Tasks Status */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                {/* Member avatars stacked */}
                <div className="flex items-center -space-x-1.5">
                  {team.members.slice(0, 4).map((member) => (
                    <Avatar
                      key={member.id}
                      src={member.avatarUrl}
                      name={member.name}
                      size="xs"
                      className="border-2 border-surface"
                    />
                  ))}
                  {team.members.length > 4 && (
                    <span className="w-5 h-5 rounded-full bg-surface-hover border border-border text-[9px] font-mono flex items-center justify-center text-text-muted">
                      +{team.members.length - 4}
                    </span>
                  )}
                </div>

                {/* Active tasks count */}
                <div className="flex items-center gap-1 font-mono text-[11px] text-text-secondary">
                  <CheckSquare className="h-3 w-3 text-blue-500" />
                  <span>진행 중 {activeCount}건</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
