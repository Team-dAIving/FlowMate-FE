import React, { useState } from 'react';
import { Code2, Settings2, Check, X } from 'lucide-react';
import {
  IDE_OPTIONS,
  IdeId,
  getProjectPath,
  isAbsolutePath,
  openProjectInIde,
  setProjectPath,
} from '../../utils/ideLauncher';

export interface ProjectIdeButtonsProps {
  projectId: string;
}

/** Per-project "open in IDE" shortcuts. The local folder is stored on this machine only. */
export const ProjectIdeButtons: React.FC<ProjectIdeButtonsProps> = ({ projectId }) => {
  const [path, setPath] = useState(() => getProjectPath(projectId));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingIde, setPendingIde] = useState<IdeId | null>(null);
  const [error, setError] = useState('');
  const [openError, setOpenError] = useState('');
  const [launchingIde, setLaunchingIde] = useState<IdeId | null>(null);

  const startEditing = (ide: IdeId | null) => {
    setDraft(path);
    setPendingIde(ide);
    setError('');
    setEditing(true);
  };

  const launch = async (ide: IdeId, target: string) => {
    if (launchingIde) return;
    setOpenError('');
    setLaunchingIde(ide);
    try {
      const message = await openProjectInIde(ide, target);
      if (message) setOpenError(message);
    } finally {
      // IDEs take a few seconds to show a window; keep the button disabled so it isn't clicked again meanwhile
      setTimeout(() => setLaunchingIde(null), 3000);
    }
  };

  const handleOpen = (ide: IdeId) => {
    if (!path) {
      startEditing(ide);
      return;
    }
    launch(ide, path);
  };

  const handleSave = () => {
    const value = draft.trim();
    if (value && !isAbsolutePath(value)) {
      setError('절대 경로를 입력해주세요. (예: C:\\dev\\my-app)');
      return;
    }
    setProjectPath(projectId, value);
    setPath(value);
    setEditing(false);
    if (value && pendingIde) launch(pendingIde, value);
    setPendingIde(null);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (editing) {
    return (
      <div onClick={stop} className="space-y-1">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="로컬 프로젝트 폴더 경로"
            className="h-7 flex-1 min-w-0 rounded-md border border-border bg-surface px-2 text-[11px] font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleSave}
            title="저장"
            className="p-1 rounded text-emerald-500 hover:bg-surface-hover"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            title="취소"
            className="p-1 rounded text-text-muted hover:bg-surface-hover"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div onClick={stop} className="space-y-1">
    <div className="flex items-center gap-1">
      {IDE_OPTIONS.map((ide) => (
        <button
          key={ide.id}
          type="button"
          onClick={() => handleOpen(ide.id)}
          disabled={launchingIde !== null}
          title={path ? `${ide.label}로 ${path} 열기` : `${ide.label}로 열기 (폴더 경로 설정 필요)`}
          className="h-6 px-2 rounded-md border border-border bg-surface hover:bg-surface-hover text-[10px] font-medium text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Code2 className="h-3 w-3" />
          <span>{launchingIde === ide.id ? '여는 중…' : ide.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => startEditing(null)}
        title="로컬 폴더 경로 설정"
        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover"
      >
        <Settings2 className="h-3 w-3" />
      </button>
    </div>
    {openError && <p className="text-[10px] text-red-500 max-w-xs">{openError}</p>}
    </div>
  );
};
