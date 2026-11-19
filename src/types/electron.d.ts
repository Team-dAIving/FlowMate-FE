export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  showNotification: (title: string, body: string) => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  onCommandPalette: (callback: () => void) => () => void;
  onMeetingShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
