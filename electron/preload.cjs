const { contextBridge, ipcRenderer } = require('electron');

// Safe, restricted IPC API according to FlowMate Security specification
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  showNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body });
  },
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onCommandPalette: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-command-palette', handler);
    return () => ipcRenderer.removeListener('toggle-command-palette', handler);
  },
  onMeetingShortcut: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-meeting-recording', handler);
    return () => ipcRenderer.removeListener('trigger-meeting-recording', handler);
  },
});
