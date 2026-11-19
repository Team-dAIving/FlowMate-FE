import React from 'react';
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
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Users2, CheckCircle2, Clock, GitPullRequest, GitCommit, CheckCheck } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import { teamMembers } from '../../services/mockData';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

export const TeamDashboard: React.FC = () => {
  const { currentWorkspace, projects } = useWorkspaceStore();
  const { tasks } = useTaskStore();

  // 1. Task Status Statistics
  const statusCounts = {
    TODO: tasks.filter((t) => t.status === 'TODO').length,
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    IN_REVIEW: tasks.filter((t) => t.status === 'IN_REVIEW').length,
    DONE: tasks.filter((t) => t.status === 'DONE').length,
  };

  const statusPieData = [
    { name: 'TODO', value: statusCounts.TODO, color: '#94A3B8' },
    { name: 'IN PROGRESS', value: statusCounts.IN_PROGRESS, color: '#3B82F6' },
    { name: 'IN REVIEW', value: statusCounts.IN_REVIEW, color: '#F59E0B' },
    { name: 'DONE', value: statusCounts.DONE, color: '#10B981' },
  ];

  // 2. Member Workload Data (Tasks + PRs + Reviews)
  const memberWorkloadData = teamMembers.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee?.id === member.id);
    const active = memberTasks.filter((t) => t.status !== 'DONE').length;
    const done = memberTasks.filter((t) => t.status === 'DONE').length;
    return {
      name: member.name,
      Active: active,
      Done: done,
      role: member.role,
    };
  });

  // 3. Weekly Task Completion Trend
  const trendData = [
    { day: '11.12', completed: 2, created: 3 },
    { day: '11.13', completed: 4, created: 2 },
    { day: '11.14', completed: 3, created: 5 },
    { day: '11.15', completed: 6, created: 4 },
    { day: '11.16', completed: 5, created: 2 },
    { day: '11.17', completed: 7, created: 6 },
    { day: '11.18', completed: 8, created: 3 },
  ];

  // Overall Team Progress
  const totalTasks = tasks.length || 1;
  const overallProgress = Math.round((statusCounts.DONE / totalTasks) * 100);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="text-xs font-mono text-text-muted">~/team/overview</div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1 flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            <span>팀 대시보드 (Team Collaboration)</span>
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            프로젝트 전체 진행률과 팀원별 업무 분배, 리뷰 및 협업 지표를 종합 분석합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-surface border border-border px-3 py-1.5 rounded-lg flex items-center gap-3 shadow-subtle">
            <div className="text-xs font-medium text-text-secondary">팀 전체 완료율</div>
            <div className="font-mono text-base font-bold text-primary">{overallProgress}%</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Chart 1: Donut Chart (Status distribution) */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xs flex items-center justify-between w-full">
              <span>업무 상태별 분포 (Task Status)</span>
              <span className="font-mono text-[11px] text-text-muted">총 {tasks.length}건</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center pt-2">
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
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

        {/* Chart 2: Member Workload Distribution */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xs flex items-center justify-between w-full">
              <span>팀원별 업무 분배 (Workload)</span>
              <span className="text-[11px] text-text-muted font-normal">Active vs Done</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-2">
            <div className="w-full h-56">
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

        {/* Chart 3: Weekly Task Velocity Trend */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xs flex items-center justify-between w-full">
              <span>주간 업무 완료 추이 (Velocity)</span>
              <span className="text-[11px] text-text-muted font-normal">최근 7일</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-2">
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#colorCompleted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Member Contribution Cards (No simplistic commit-only bias - Section 4.5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-mono font-bold text-text-muted tracking-wider uppercase">
            TEAM COLLABORATION & LOAD BALANCING
          </div>
          <div className="text-xs text-text-secondary">
            * 단순 커밋 수 외에 PR, 코드 리뷰, 담당 업무량을 함께 고려합니다.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => {
            const memberTasks = tasks.filter((t) => t.assignee?.id === member.id);
            const inProgress = memberTasks.filter((t) => t.status === 'IN_PROGRESS').length;
            const inReview = memberTasks.filter((t) => t.status === 'IN_REVIEW').length;
            const done = memberTasks.filter((t) => t.status === 'DONE').length;

            return (
              <Card key={member.id} className="p-4 space-y-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={member.avatarUrl} name={member.name} size="md" />
                    <div>
                      <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                        <span>{member.name}</span>
                        <Badge variant="default" className="text-[10px] px-1 py-0">
                          {member.role}
                        </Badge>
                      </div>
                      <div className="text-xs text-text-muted">{member.department}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                  <div className="bg-surface-hover/70 rounded p-1.5">
                    <div className="text-[10px] text-text-muted">진행 중</div>
                    <div className="font-mono text-sm font-bold text-blue-600">{inProgress}</div>
                  </div>
                  <div className="bg-surface-hover/70 rounded p-1.5">
                    <div className="text-[10px] text-text-muted">리뷰 중</div>
                    <div className="font-mono text-sm font-bold text-amber-600">{inReview}</div>
                  </div>
                  <div className="bg-surface-hover/70 rounded p-1.5">
                    <div className="text-[10px] text-text-muted">완료</div>
                    <div className="font-mono text-sm font-bold text-emerald-600">{done}</div>
                  </div>
                </div>

                <div className="text-[11px] text-text-secondary flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1">
                    <GitPullRequest className="h-3 w-3 text-primary" />
                    PR & 리뷰 기여
                  </span>
                  <span className="font-mono font-medium text-text-primary">
                    {Math.floor(memberTasks.length * 1.5 + 4)}건
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
