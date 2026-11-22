import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Github, LogOut, Mail, UserRound, Users2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useTeamStore } from '../../store/useTeamStore';
import { useAuthStore } from '../../store/useAuthStore';
import { USE_REAL_API } from '../../services/http';
import { NICKNAME_LIMITS } from '../../services/authApi';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

/** My page: who I am, the code teammates invite me with, my teams, and the nickname I can change. */
export const MyPage: React.FC = () => {
  const { currentUser, updateNickname, setCurrentView, setSelectedTeamId } = useWorkspaceStore();
  const { teams, fetchTeams } = useTeamStore();
  const logout = useAuthStore((s) => s.logout);

  const [nickname, setNickname] = useState(currentUser?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  // The profile loads after this page can already be open; follow it until the user starts editing
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setNickname(currentUser?.name || '');
  }, [currentUser?.name, touched]);
  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  if (!currentUser) {
    return <div className="p-12 text-center text-xs text-text-muted">내 정보를 불러오는 중…</div>;
  }

  const trimmed = nickname.trim();
  const unchanged = trimmed === currentUser.name;
  const invalid = trimmed.length === 0 || trimmed.length > NICKNAME_LIMITS.MAX;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || unchanged) return;
    if (invalid) {
      setMessage({ kind: 'error', text: `닉네임은 1~${NICKNAME_LIMITS.MAX}자로 입력해주세요.` });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await updateNickname(trimmed);
      setNickname(updated.name);
      setTouched(false);
      setMessage({ kind: 'ok', text: '닉네임을 변경했습니다.' });
      void fetchTeams(); // team member lists show the new name
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error && err.message ? err.message : '닉네임 변경에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyCode = () => {
    if (!currentUser.userCode) return;
    navigator.clipboard
      .writeText(currentUser.userCode)
      .then(() => {
        setCopied(true);
        if (copyTimer.current) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // clipboard blocked: the code is still selectable
      });
  };

  const openTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setCurrentView('team-detail', teamId);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="pb-2 border-b border-border/80">
        <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <span>마이페이지</span>
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">내 프로필과 팀 초대용 유저 코드를 확인하고 닉네임을 바꿀 수 있습니다.</p>
      </div>

      {/* Profile */}
      <Card className="p-5 flex items-center gap-4">
        <Avatar src={currentUser.avatarUrl} name={currentUser.name} size="lg" />
        <div className="min-w-0 space-y-1">
          <div className="text-base font-bold text-text-primary truncate">{currentUser.name}</div>
          {currentUser.githubLogin && (
            <div className="text-xs text-text-secondary flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5" />
              <span className="font-mono">@{currentUser.githubLogin}</span>
            </div>
          )}
          {currentUser.email && (
            <div className="text-xs text-text-secondary flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{currentUser.email}</span>
            </div>
          )}
          {currentUser.department && <div className="text-xs text-text-muted">{currentUser.department}</div>}
        </div>
      </Card>

      {/* User code */}
      {currentUser.userCode && (
        <Card className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">내 유저 코드</div>
            <div className="font-mono text-lg font-bold text-primary tracking-[0.2em] select-all">{currentUser.userCode}</div>
            <p className="text-[11px] text-text-muted">팀이나 프로젝트에 초대받을 때 이 코드를 알려주세요.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={copyCode} className="gap-1.5 shrink-0">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? '복사됨' : '복사'}</span>
          </Button>
        </Card>
      )}

      {/* Nickname */}
      <Card className="p-4">
        <form onSubmit={handleSave} className="space-y-3">
          <Input
            label="닉네임"
            value={nickname}
            maxLength={NICKNAME_LIMITS.MAX}
            onChange={(e) => {
              setNickname(e.target.value);
              setTouched(true);
              setMessage(null);
            }}
            error={message?.kind === 'error' ? message.text : undefined}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-text-muted">
              팀원에게 보이는 이름입니다. 프로필 사진과 이메일은 GitHub 계정 정보를 따릅니다.
            </p>
            <Button type="submit" size="sm" isLoading={isSaving} disabled={unchanged || invalid}>
              저장
            </Button>
          </div>
          {message?.kind === 'ok' && (
            <p role="status" className="text-[11px] text-emerald-600">
              {message.text}
            </p>
          )}
        </form>
      </Card>

      {/* Teams */}
      <Card className="p-4 space-y-2">
        <div className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
          <Users2 className="h-3.5 w-3.5 text-primary" />
          <span>참여 중인 팀 ({teams.length})</span>
        </div>
        {teams.length === 0 ? (
          <p className="text-[11px] text-text-muted">아직 참여 중인 팀이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTeam(t.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface-hover/70 hover:border-primary/50 text-xs transition-colors"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#4F46E5' }} />
                <span className="font-semibold text-text-primary">{t.name}</span>
                <span className="text-text-muted text-[10px]">({t.memberCount}명)</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Account */}
      {USE_REAL_API && (
        <Card className="p-4 flex items-center justify-between gap-3">
          <div className="text-xs text-text-secondary">GitHub 계정으로 로그인되어 있습니다.</div>
          <Button type="button" size="sm" variant="outline" onClick={() => void logout()} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            <span>로그아웃</span>
          </Button>
        </Card>
      )}
    </div>
  );
};
