const { contextBridge, ipcRenderer } = require('electron');

// Safe, restricted IPC API according to FlowMate Security specification
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  showNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body });
  },
  openInIde: (url) => ipcRenderer.send('open-in-ide', url),
  openInIntellij: (projectPath) => ipcRenderer.invoke('open-intellij', projectPath),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onCommandPalette: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-command-palette', handler);
    return () => ipcRenderer.removeListener('toggle-command-palette', handler);
  },
  // Auth lives in the main process; the renderer never sees the token
  auth: {
    getState: () => ipcRenderer.invoke('auth:get-state'),
    startLogin: () => ipcRenderer.invoke('auth:start-login'),
    clear: () => ipcRenderer.invoke('auth:clear'),
    onResult: (callback) => {
      const handler = (_event, result) => callback(result);
      ipcRenderer.on('auth:result', handler);
      return () => ipcRenderer.removeListener('auth:result', handler);
    },
  },
  onMeetingShortcut: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-meeting-recording', handler);
    return () => ipcRenderer.removeListener('trigger-meeting-recording', handler);
  },
});
