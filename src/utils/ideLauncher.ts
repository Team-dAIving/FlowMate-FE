import { useWorkspaceStore } from '../store/useWorkspaceStore';

export type IdeId = 'vscode' | 'intellij';

export const IDE_OPTIONS: { id: IdeId; label: string }[] = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'intellij', label: 'IntelliJ' },
];

// Absolute path: "C:\dev\app", "C:/dev/app", "/home/me/app", "\\server\share"
const ABSOLUTE_PATH = /^([A-Za-z]:[\\/]|\/|\\\\)/;

export function isAbsolutePath(path: string): boolean {
  return ABSOLUTE_PATH.test(path.trim());
}

/** Builds the IDE's registered URL-scheme link for opening a project folder. */
export function buildIdeUrl(ide: IdeId, rawPath: string): string {
  const path = rawPath.trim().replace(/\\/g, '/');
  switch (ide) {
    case 'vscode': {
      // vscode://file/C:/dev/app  |  vscode://file/home/me/app
      // Encode each segment so '#', '?' or '%' in a folder name can't change the URL's meaning.
      const encoded = path
        .split('/')
        .map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
        .join('/');
      return `vscode://file${encoded.startsWith('/') ? '' : '/'}${encoded}`;
    }
    case 'intellij':
      // JetBrains Toolbox URL handler
      return `idea://open?file=${encodeURIComponent(path)}`;
  }
}

/** Returns an error message to show the user, or null when the IDE was launched. */
export async function openProjectInIde(ide: IdeId, path: string): Promise<string | null> {
  // IntelliJ: launch the app directly in Electron (the idea:// URL only works with JetBrains Toolbox)
  if (ide === 'intellij' && window.electronAPI?.openInIntellij) {
    const result = await window.electronAPI.openInIntellij(path.trim());
    return result.ok ? null : result.message || 'IntelliJ를 열지 못했습니다.';
  }
  const url = buildIdeUrl(ide, path);
  if (window.electronAPI?.openInIde) {
    window.electronAPI.openInIde(url);
  } else {
    // Browser: hands the custom-scheme URL to the OS
    window.location.href = url;
  }
  return null;
}

// ---- Local folder per project. Machine-specific, so it lives in localStorage, not on the server. ----
// Kept per signed-in user: another account on the same computer must not see someone else's folders.
const PATHS_KEY = 'flowmate_project_paths';
const pathsKey = () => {
  const userId = useWorkspaceStore.getState().currentUser?.id;
  return userId ? `${PATHS_KEY}:${userId}` : PATHS_KEY;
};

function readPaths(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(pathsKey()) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getProjectPath(projectId: string): string {
  return readPaths()[projectId] || '';
}

export function setProjectPath(projectId: string, path: string): void {
  const all = readPaths();
  const trimmed = path.trim();
  if (trimmed) all[projectId] = trimmed;
  else delete all[projectId];
  try {
    localStorage.setItem(pathsKey(), JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save project path:', err);
  }
}
