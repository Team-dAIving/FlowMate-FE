import React, { useEffect, useState } from 'react';
import { Search, X, UserPlus, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useTeamStore } from '../../store/useTeamStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { Avatar } from '../ui/Avatar';
import { api } from '../../services/api';
import { PublicUserProfile, USER_CODE_PATTERN } from '../../types';

export interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamCreateModal: React.FC<TeamCreateModalProps> = ({ isOpen, onClose }) => {
  const { createTeam } = useTeamStore();
  const { currentWorkspace, currentUser } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [isLoading, setIsLoading] = useState(false);

  // Member search by user code
  const [userCodeInput, setUserCodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // Current user is always auto-included as first member (cannot be removed)
  const [addedMembers, setAddedMembers] = useState<PublicUserProfile[]>([]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setColor('#4F46E5');
    setAddedMembers(currentUser ? [currentUser] : []);
    setUserCodeInput('');
    setSearchError('');
  };

  // Modal stays mounted and currentUser loads async, so (re)initialize on every open
  useEffect(() => {
    if (isOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser?.id]);

  const handleUserCodeSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    // Enter inside a <form> would otherwise submit it and create the team immediately
    e.preventDefault();
    if (e.nativeEvent.isComposing || isSearching) return;

    const code = userCodeInput.trim().toUpperCase();
    if (!code) return;
    if (!USER_CODE_PATTERN.test(code)) {
      setSearchError('유저 코드는 영문 대문자/숫자 6자리입니다.');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const found = await api.findUserByCode(code);
      if (!found) {
        setSearchError(`"${code}"에 해당하는 유저를 찾을 수 없습니다.`);
      } else if (found.id === currentUser?.id) {
        setSearchError('본인은 이미 팀에 포함되어 있습니다.');
      } else if (addedMembers.some((m) => m.id === found.id)) {
        setSearchError(`${found.name}은(는) 이미 추가되었습니다.`);
      } else {
        setAddedMembers((prev) => (prev.some((m) => m.id === found.id) ? prev : [...prev, found]));
        setUserCodeInput('');
        setSearchError('');
      }
    } catch {
      setSearchError('유저 조회 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const removeMember = (userId: string) => {
    // Cannot remove the current user (auto-included owner)
    if (userId === currentUser?.id) return;
    setAddedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await createTeam({
        workspaceId: currentWorkspace?.id || 'ws-flowmate',
        name: name.trim(),
        description: description.trim(),
        // api.createTeam also guarantees the creator is included
        memberIds: Array.from(new Set([...(currentUser ? [currentUser.id] : []), ...addedMembers.map((m) => m.id)])),
        projectIds: [], // 프로젝트는 팀 생성 후 연결
        color,
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const COLOR_OPTIONS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#2563EB', '#DB2777'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title="새 팀 생성 (Create Team)"
      description="팀 이름과 역할을 설정하고, 유저 코드로 팀원을 초대하세요. 프로젝트는 팀 생성 후 연결할 수 있습니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Team Name + Color */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <Input
              label="팀 이름 (Team Name)"
              placeholder="예: Core Frontend Team, AI Research Squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              테마 색상
            </label>
            <div className="flex items-center gap-1.5 pt-1">
              {COLOR_OPTIONS.slice(0, 4).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    color === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <Textarea
          label="팀 역할 및 주요 업무 분야 (Responsibilities)"
          placeholder="예: React/Electron 기반 클라이언트 런타임 및 개발자 UI/UX 컴포넌트 개발"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        {/* Member Search by User Code */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            팀원 초대 — 유저 코드 검색
          </label>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              value={userCodeInput}
              onChange={(e) => {
                setUserCodeInput(e.target.value.toUpperCase());
                setSearchError('');
              }}
              onKeyDown={handleUserCodeSearch}
              placeholder="유저 코드 입력 후 Enter (예: A3H9WD)"
              maxLength={6}
              className="w-full h-8 pl-8 pr-10 rounded-md border border-border bg-surface text-xs text-text-primary font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
            )}
          </div>

          {/* Search error */}
          {searchError && (
            <p className="mt-1 text-[11px] text-red-500">{searchError}</p>
          )}

          {/* Added members chips */}
          {addedMembers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {addedMembers.map((member) => {
                const isCurrentUser = member.id === currentUser?.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-full border border-border bg-surface-hover text-xs text-text-primary"
                  >
                    <Avatar src={member.avatarUrl} name={member.name} size="xs" />
                    <span className="font-medium">{member.name}</span>
                    {member.userCode && (
                      <span className="font-mono text-[10px] text-text-muted">({member.userCode})</span>
                    )}
                    {isCurrentUser ? (
                      <span className="text-[10px] text-primary font-semibold ml-0.5">나</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-950/40 text-text-muted hover:text-red-500 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-1.5 text-[11px] text-text-muted flex items-center gap-1">
            <UserPlus className="h-3 w-3" />
            팀원의 유저 코드를 입력하고 Enter를 누르세요. 유저 코드는 홈 대시보드에서 확인 가능합니다.
          </p>
        </div>

        {/* Info: Projects connected later */}
        <div className="p-3 rounded-md border border-border/60 bg-surface-hover/40 text-[11px] text-text-muted">
          💡 프로젝트 연결은 팀 생성 후 <strong className="text-text-secondary">팀 상세 화면</strong>에서, 또는{' '}
          <strong className="text-text-secondary">프로젝트 생성 시 소속 팀 선택</strong>으로 연결할 수 있습니다.
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading}>
            팀 생성
          </Button>
        </div>
      </form>
    </Modal>
  );
};

