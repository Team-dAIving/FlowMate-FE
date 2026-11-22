import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NICKNAME_LIMITS } from '../../services/authApi';
import { useAuthStore } from '../../store/useAuthStore';

/** Shown on a user's first login. It cannot be dismissed; a nickname is required. */
export const NicknameDialog: React.FC = () => {
  const submitNickname = useAuthStore((s) => s.submitNickname);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const value = nickname.trim();
    if (value.length === 0 || value.length > NICKNAME_LIMITS.MAX) {
      setError(`닉네임을 1~${NICKNAME_LIMITS.MAX}자로 입력해주세요.`);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await submitNickname(value);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '닉네임 설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-title"
        className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-modal p-6 space-y-4"
      >
        <div>
          <h2 id="nickname-title" className="text-base font-semibold text-text-primary">
            닉네임을 설정해주세요
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            처음 로그인하셨네요. 팀원에게 보여질 닉네임을 정해주세요.
          </p>
        </div>

        <Input
          autoFocus
          label="닉네임"
          placeholder="예: 김개발"
          value={nickname}
          maxLength={NICKNAME_LIMITS.MAX}
          onChange={(e) => {
            setNickname(e.target.value);
            setError('');
          }}
          error={error}
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          시작하기
        </Button>
      </form>
    </div>
  );
};
