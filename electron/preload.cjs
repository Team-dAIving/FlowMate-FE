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
  // flowmate://oauth/callback?... forwarded from the main process after the browser login
  onOAuthCallback: (callback) => {
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('oauth-callback', handler);
    return () => ipcRenderer.removeListener('oauth-callback', handler);
  },
  onMeetingShortcut: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-meeting-recording', handler);
    return () => ipcRenderer.removeListener('trigger-meeting-recording', handler);
  },
});
