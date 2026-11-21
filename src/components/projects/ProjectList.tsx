import React from 'react';
import { Plus, FolderKanban, GitBranch, Calendar, Users, ArrowUpRight } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatDate } from '../../utils/formatters';

export const ProjectList: React.FC = () => {
  const { projects, setCurrentView } = useWorkspaceStore();
  const { tasks } = useTaskStore();
  const { setCreateProjectModalOpen } = useUIStore();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="text-xs font-mono text-text-muted">~/workspace/projects</div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1 flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <span>프로젝트 목록 (Projects)</span>
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            팀의 전체 프로젝트와 진척도, 연결된 GitHub 저장소를 확인합니다.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateProjectModalOpen(true)}
          className="text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>새 프로젝트</span>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((proj) => {
          const projTasks = tasks.filter((t) => t.projectId === proj.id);
          const doneTasks = projTasks.filter((t) => t.status === 'DONE').length;
          const calculatedProgress =
            projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : proj.progress;

          return (
            <Card
              key={proj.id}
              hoverEffect
              onClick={() => setCurrentView('project-detail', proj.id)}
              className="p-4 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Top: Key & Type */}
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="text-[10px] uppercase font-mono">
                    {proj.projectType}
                  </Badge>
                </div>

                {/* Name & Desc */}
                <div>
                  <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>{proj.name}</span>
                    <ArrowUpRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                    {proj.description}
                  </p>
                </div>

                {/* Tech stack tags */}
                <div className="flex flex-wrap gap-1">
                  {proj.techStack.slice(0, 4).map((tech) => (
                    <span
                      key={tech}
                      className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border/60"
                    >
                      {tech}
                    </span>
                  ))}
                  {proj.techStack.length > 4 && (
                    <span className="text-[10px] font-mono text-text-muted">
                      +{proj.techStack.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom: Progress bar & Members */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-muted">진행률</span>
                    <span className="font-bold text-text-primary">{calculatedProgress}%</span>
                  </div>
                  <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${calculatedProgress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div className="flex items-center -space-x-1.5">
                    {proj.members.slice(0, 3).map((m) => (
                      <Avatar
                        key={m.user.id}
                        src={m.user.avatarUrl}
                        name={m.user.name}
                        size="xs"
                        className="border-2 border-surface"
                      />
                    ))}
                    {proj.members.length > 3 && (
                      <span className="w-5 h-5 rounded-full bg-surface-hover border border-border text-[9px] font-mono flex items-center justify-center text-text-muted">
                        +{proj.members.length - 3}
                      </span>
                    )}
                  </div>

                  {proj.githubRepo && (
                    <span className="text-[11px] font-mono flex items-center gap-1 text-text-secondary hover:text-text-primary">
                      <GitBranch className="h-3 w-3" />
                      <span>{proj.githubRepo.name}</span>
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
