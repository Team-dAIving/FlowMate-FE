import React, { useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { ProjectPosition } from '../../types';
import {
  POSITIONS,
  PicksByPosition,
  SKILLS_BY_POSITION,
  SKILL_MAX_LENGTH,
  SKILLS_MAX,
  normalizeSkills,
  switchPosition,
} from '../../utils/positions';
import { cn } from '../../utils/cn';

export interface MemberRoleEditorProps {
  position?: ProjectPosition;
  skills: string[];
  onChange: (position: ProjectPosition | undefined, skills: string[]) => void;
}

/**
 * Pick one position (백엔드/프론트엔드/디자인/PM/기타), then any number of that position's skills.
 * Skills are per position: switching to another position starts from that position's own picks.
 */
export const MemberRoleEditor: React.FC<MemberRoleEditorProps> = ({ position, skills, onChange }) => {
  const [custom, setCustom] = useState('');
  // Skills belong to a position: switching positions must not carry them over. Remember each
  // position's picks while the editor is open, so switching back restores them.
  const picksByPosition = useRef<PicksByPosition>({});

  const selectPosition = (next: ProjectPosition | undefined) => {
    const r = switchPosition(picksByPosition.current, position, skills, next);
    picksByPosition.current = r.memo;
    setCustom('');
    onChange(next, r.skills);
  };

  const selected = new Set(skills.map((s) => s.toLowerCase()));
  const suggestions = position ? SKILLS_BY_POSITION[position] : [];
  // Picked skills the suggestion list doesn't show (typed in by hand)
  const extras = skills.filter((s) => !suggestions.some((x) => x.toLowerCase() === s.toLowerCase()));
  const atMax = skills.length >= SKILLS_MAX;

  const toggle = (skill: string) => {
    if (selected.has(skill.toLowerCase())) {
      onChange(position, skills.filter((s) => s.toLowerCase() !== skill.toLowerCase()));
    } else if (!atMax) {
      onChange(position, normalizeSkills([...skills, skill]));
    }
  };

  const addCustom = () => {
    const value = custom.trim();
    if (!position || !value || atMax) return;
    onChange(position, normalizeSkills([...skills, value]));
    setCustom('');
  };

  const chip = (skill: string, on: boolean) => (
    <button
      key={skill}
      type="button"
      onClick={() => toggle(skill)}
      aria-pressed={on}
      disabled={!on && atMax}
      className={cn(
        'h-6 px-2 rounded-full border text-[11px] flex items-center gap-1 transition-colors disabled:opacity-40',
        on
          ? 'border-primary bg-primary/10 text-primary font-medium'
          : 'border-border bg-surface text-text-secondary hover:border-primary/50'
      )}
    >
      {on && <Check className="h-3 w-3" />}
      {skill}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="포지션">
        {POSITIONS.map((p) => {
          const on = position === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPosition(on ? undefined : p.id)}
              aria-pressed={on}
              className={cn(
                'h-7 px-2.5 rounded-md border text-xs transition-colors',
                on ? 'text-white font-semibold border-transparent' : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
              )}
              style={on ? { backgroundColor: p.color } : undefined}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {!position && <p className="text-[11px] text-text-muted">포지션을 고르면 기술 스택을 선택할 수 있습니다.</p>}
      {position && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="기술 스택">
            {suggestions.map((s) => chip(s, selected.has(s.toLowerCase())))}
            {extras.map((s) => chip(s, true))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                // Enter inside the project form would submit it
                e.preventDefault();
                if (!e.nativeEvent.isComposing) addCustom();
              }}
              // Typed but never confirmed with Enter (e.g. went straight to 저장/생성): keep it instead of dropping it
              onBlur={() => {
                if (custom.trim()) addCustom();
              }}
              maxLength={SKILL_MAX_LENGTH}
              placeholder="목록에 없으면 직접 입력 후 Enter"
              aria-label="기술 스택 직접 입력"
              disabled={atMax}
              className="h-7 flex-1 min-w-0 rounded-md border border-border bg-surface px-2 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!custom.trim() || atMax}
              aria-label="기술 스택 추가"
              className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-text-secondary hover:bg-surface-hover disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {atMax && <p className="text-[10px] text-text-muted">기술 스택은 최대 {SKILLS_MAX}개까지 고를 수 있습니다.</p>}
        </div>
      )}
    </div>
  );
};
