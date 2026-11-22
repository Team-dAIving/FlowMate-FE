export type AuthResult =
  | { ok: true; onboardingRequired: boolean }
  | { ok: false; error: string };

/** Main-process auth. The JWT stays in the main process; none of these return it. */
export interface ElectronAuthAPI {
  getState: () => Promise<{ loggedIn: boolean; apiConfigured: boolean }>;
  startLogin: () => Promise<{ ok: boolean; message?: string }>;
  clear: () => Promise<void>;
  onResult: (callback: (result: AuthResult) => void) => () => void;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  showNotification: (title: string, body: string) => void;
  openInIde: (url: string) => void;
  openInIntellij: (projectPath: string) => Promise<{ ok: boolean; message?: string }>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  onCommandPalette: (callback: () => void) => () => void;
  auth: ElectronAuthAPI;
  onMeetingShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
