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
  onOAuthCallback: (callback: (url: string) => void) => () => void;
  onMeetingShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
