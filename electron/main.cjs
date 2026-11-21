const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

// ---- IntelliJ IDEA launcher ----
// Runs `file args...` detached, no shell. Resolves { ok } once the process spawned or failed to.
function spawnDetached(file, args) {
  return new Promise((resolve) => {
    let child;
    try {
      // No windowsHide: on Windows it hides a GUI app's first window, so the IDE would start invisible.
      child = spawn(file, args, { detached: true, stdio: 'ignore' });
    } catch (err) {
      resolve({ ok: false, error: err });
      return;
    }
    child.once('error', (err) => resolve({ ok: false, error: err }));
    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true });
    });
  });
}

// Newest first: '2025.10' sorts above '2025.9'
const byVersionDesc = (a, b) => b.localeCompare(a, undefined, { numeric: true });

// Newest IntelliJ install under a JetBrains root, e.g. "C:\Program Files\JetBrains"
function findInstalledIdea(root, exeRelative) {
  try {
    const dirs = fs
      .readdirSync(root)
      .filter((d) => /^IntelliJ IDEA/i.test(d))
      .sort(byVersionDesc);
    for (const d of dirs) {
      const exe = path.join(root, d, exeRelative);
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    // root does not exist
  }
  return null;
}

// IntelliJ allows one instance; a second launch hands the path to the first over a socket.
// While the first is still booting it can't answer, and the second one fails with CannotActivateException.
// So ignore repeat clicks for a while after a launch.
const INTELLIJ_LAUNCH_COOLDOWN_MS = 15000;
let lastIntellijLaunchAt = 0;

async function openInIntellij(projectPath) {
  const now = Date.now();
  if (now - lastIntellijLaunchAt < INTELLIJ_LAUNCH_COOLDOWN_MS) {
    return { ok: false, message: 'IntelliJ를 여는 중입니다. 잠시만 기다려주세요.' };
  }
  const result = await launchIntellij(projectPath);
  if (result.ok) lastIntellijLaunchAt = Date.now();
  return result;
}

async function launchIntellij(projectPath) {
  const attempts = [];

  if (process.platform === 'win32') {
    const programFiles = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
    const localAppData = process.env.LOCALAPPDATA;
    for (const pf of programFiles) {
      const exe = findInstalledIdea(path.join(pf, 'JetBrains'), path.join('bin', 'idea64.exe'));
      if (exe) attempts.push([exe, [projectPath]]);
    }
    if (localAppData) {
      // Toolbox-managed installs
      const toolboxApps = path.join(localAppData, 'JetBrains', 'Toolbox', 'apps');
      for (const channel of ['IDEA-U', 'IDEA-C', 'IntelliJ-IDEA-Ultimate', 'IntelliJ-IDEA-Community']) {
        try {
          const chDir = path.join(toolboxApps, channel);
          for (const sub of fs.readdirSync(chDir)) {
            for (const ver of fs.readdirSync(path.join(chDir, sub)).sort(byVersionDesc)) {
              const exe = path.join(chDir, sub, ver, 'bin', 'idea64.exe');
              if (fs.existsSync(exe)) attempts.push([exe, [projectPath]]);
            }
          }
        } catch {
          // channel not installed
        }
      }
    }
    attempts.push(['idea64.exe', [projectPath]]); // on PATH
  } else if (process.platform === 'darwin') {
    for (const app of ['IntelliJ IDEA', 'IntelliJ IDEA CE', 'IntelliJ IDEA Ultimate']) {
      attempts.push(['open', ['-a', app, projectPath]]);
    }
  } else {
    attempts.push(['idea', [projectPath]], ['idea.sh', [projectPath]]);
  }

  for (const [file, args] of attempts) {
    const result = await spawnDetached(file, args);
    if (result.ok) return { ok: true };
  }
  return {
    ok: false,
    message:
      'IntelliJ IDEA를 찾을 수 없습니다. 설치 여부를 확인하거나, IntelliJ에서 Tools > Create Command-line Launcher로 `idea` 명령을 등록해주세요.',
  };
}

// ---- Renderer trust: only our own app page may use privileged IPC or stay in the main window ----
const DEV_ORIGIN = 'http://localhost:5173';
function isAppUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return isDev ? u.origin === DEV_ORIGIN : u.protocol === 'file:';
  } catch {
    return false;
  }
}
function isTrustedSender(event) {
  const frame = event.senderFrame;
  return Boolean(mainWindow && event.sender === mainWindow.webContents && frame && isAppUrl(frame.url));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Custom developer-centric titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#F7F8FA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, '../public/flowmate-icon.png'),
  });

  // Open external links (GitHub issues, documentation) in OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Graceful fallback if tray icon doesn't exist yet
  try {
    const iconPath = path.join(__dirname, '../public/flowmate-icon.png');
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open FlowMate',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        },
      },
      {
        label: 'Quick Meeting Recording',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('trigger-meeting-recording');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit FlowMate',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setToolTip('FlowMate - Developer Workspace');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (err) {
    console.log('Tray creation note: icon file not found, tray skipped in dev.');
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register Global Shortcuts
  // Ctrl+Shift+K or Alt+Space for quick command palette
  try {
    globalShortcut.register('CommandOrControl+Alt+K', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('toggle-command-palette');
      }
    });
  } catch (e) {
    console.log('Global shortcut registration failed:', e);
  }

  // IPC Handlers
  ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title: title || 'FlowMate', body: body || '' }).show();
    }
  });

  // Open a project folder in VS Code. Only vscode://file/... is allowed: other vscode:// URIs
  // are handled by extensions and could trigger actions we never intended.
  ipcMain.on('open-in-ide', (event, url) => {
    if (!isTrustedSender(event)) return;
    if (typeof url !== 'string' || url.length > 4096) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'vscode:' && parsed.host === 'file') {
        shell.openExternal(url);
      }
    } catch {
      // malformed URL: ignore
    }
  });

  // IntelliJ: the idea:// URL needs JetBrains Toolbox, so launch the IDE itself instead.
  ipcMain.handle('open-intellij', async (event, projectPath) => {
    if (!isTrustedSender(event)) return { ok: false, message: '허용되지 않은 요청입니다.' };
    if (typeof projectPath !== 'string' || projectPath.length > 4096 || !path.isAbsolute(projectPath)) {
      return { ok: false, message: '절대 경로가 필요합니다.' };
    }
    try {
      if (!fs.statSync(projectPath).isDirectory()) throw new Error('not a directory');
    } catch {
      return { ok: false, message: `폴더를 찾을 수 없습니다: ${projectPath}` };
    }
    return openInIntellij(projectPath);
  });

  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
