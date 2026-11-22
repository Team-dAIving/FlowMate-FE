import React, { useEffect, useRef, useState } from 'react';
import { Search, X, UserPlus, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useTeamStore } from '../../store/useTeamStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { Avatar } from '../ui/Avatar';
import { api } from '../../services/api';
import { PublicUserProfile, TEAM_LIMITS, USER_CODE_PATTERN } from '../../types';

export interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamCreateModal: React.FC<TeamCreateModalProps> = ({ isOpen, onClose }) => {
  const { createTeam } = useTeamStore();
  const { currentUser } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Member search by user code
  const [userCodeInput, setUserCodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // Current user is always auto-included as first member (cannot be removed)
  const [addedMembers, setAddedMembers] = useState<PublicUserProfile[]>([]);

  // Bumped on every reset: a user-code lookup that finishes after the form was reset is discarded
  const formSeq = useRef(0);

  const resetForm = () => {
    formSeq.current += 1;
    setName('');
    setDescription('');
    setColor('#4F46E5');
    setAddedMembers(currentUser ? [currentUser] : []);
    setUserCodeInput('');
    setSearchError('');
    setSubmitError('');
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
      const seq = formSeq.current;
      const found = await api.findUserByCode(code);
      if (seq !== formSeq.current) return; // modal was closed/reopened meanwhile
      if (!found) {
        setSearchError(`"${code}"에 해당하는 유저를 찾을 수 없습니다.`);
      } else if (found.id === currentUser?.id) {
        setSearchError('본인은 이미 팀에 포함되어 있습니다.');
      } else if (addedMembers.some((m) => m.id === found.id)) {
        setSearchError(`${found.name}은(는) 이미 추가되었습니다.`);
      } else if (addedMembers.length >= TEAM_LIMITS.MEMBERS_MAX) {
        setSearchError(`팀원은 최대 ${TEAM_LIMITS.MEMBERS_MAX}명까지 추가할 수 있습니다.`);
      } else {
        setAddedMembers((prev) => (prev.some((m) => m.id === found.id) ? prev : [...prev, found]));
        setUserCodeInput('');
        setSearchError('');
      }
    } catch (err) {
      console.error(err);
      setSearchError('유저 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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
    if (isLoading) return;
    // Mirror backend validation so the user gets immediate feedback
    if (!name.trim()) return setSubmitError('팀 이름을 입력해주세요.');
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return setSubmitError('색상은 #RRGGBB 형식으로 입력해주세요. (예: #4F46E5)');
    if (name.trim().length > TEAM_LIMITS.NAME_MAX)
      return setSubmitError(`팀 이름은 ${TEAM_LIMITS.NAME_MAX}자 이하여야 합니다.`);
    if (description.trim().length > TEAM_LIMITS.DESCRIPTION_MAX)
      return setSubmitError(`팀 설명은 ${TEAM_LIMITS.DESCRIPTION_MAX}자 이하여야 합니다.`);

    // The server adds the logged-in user to the team automatically, so only invitees are sent.
    const memberIds = Array.from(
      new Set(addedMembers.map((m) => m.id).filter((id) => id !== currentUser?.id))
    );
    // A team needs the creator (added by the server) plus at least one invitee
    if (memberIds.length < 1) return setSubmitError('팀은 본인 포함 2명 이상이어야 합니다. 유저 코드로 팀원을 초대해주세요.');
    // +1 for the creator the server adds
    if (memberIds.length + 1 > TEAM_LIMITS.MEMBERS_MAX)
      return setSubmitError(`팀원은 최대 ${TEAM_LIMITS.MEMBERS_MAX}명까지 가능합니다.`);

    setIsLoading(true);
    setSubmitError('');
    try {
      // 프로젝트는 팀 생성 후 연결
      await createTeam({ name: name.trim(), description: description.trim(), color, memberIds });

      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error && err.message ? err.message : '팀 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
  const COLOR_OPTIONS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#2563EB', '#DB2777'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title="새 팀 생성 (Create Team)"
      description="해커톤, 공모전, 경진대회, 수업 등 활동마다 팀을 만들고 유저 코드로 팀원을 초대하세요. 프로젝트는 팀 생성 후 연결할 수 있습니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Team Name + Color */}
        <div className="space-y-4">
          <Input
            label="팀 이름 (Team Name)"
            placeholder="예: 밤샘코딩, 캡스톤 7조"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={TEAM_LIMITS.NAME_MAX}
            required
          />
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              테마 색상
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    color.toUpperCase() === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}

              {/* Custom color: native picker + #RRGGBB text */}
              <span className="w-px h-5 bg-border mx-1" />
              <input
                type="color"
                value={HEX_COLOR.test(color) ? color : '#4F46E5'}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                aria-label="직접 색상 선택"
                title="직접 색상 선택"
                className="w-7 h-7 p-0 rounded border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setColor(v.startsWith('#') ? v : `#${v}`);
                }}
                maxLength={7}
                spellCheck={false}
                aria-label="색상 코드"
                aria-invalid={!HEX_COLOR.test(color)}
                className={`w-24 h-7 px-2 rounded-md border bg-surface text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  HEX_COLOR.test(color) ? 'border-border' : 'border-red-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <Textarea
          label="팀 소개 (어떤 대회·활동인지)"
          placeholder="예: 2026 대학생 SW 해커톤 참가팀. 48시간 안에 캠퍼스 생활 문제를 해결하는 앱을 만듭니다."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={TEAM_LIMITS.DESCRIPTION_MAX}
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

        {submitError && (
          <p role="alert" className="text-[11px] text-red-500">{submitError}</p>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" isLoading={isLoading} disabled={addedMembers.every((m) => m.id === currentUser?.id)}>
            팀 생성
          </Button>
        </div>
      </form>
    </Modal>
  );
};

