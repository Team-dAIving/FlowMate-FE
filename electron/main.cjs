const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, Notification, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const { spawn } = require('child_process');
const { createAuth } = require('./auth.cjs');

let mainWindow = null;
let tray = null;
// Packaged = release. (NODE_ENV is usually unset in a packaged app, so it must not decide this:
// the release build would otherwise load localhost:5173 and use the dev trust rules.)
const isDev = !app.isPackaged;

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
// Release: exactly our bundled index.html. Any other file: URL (e.g. an .html dropped on the window) is foreign.
const APP_INDEX_URL = pathToFileURL(path.join(__dirname, '../dist/index.html'));
function isAppUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (isDev) return u.origin === DEV_ORIGIN;
    return u.protocol === 'file:' && u.pathname === APP_INDEX_URL.pathname;
  } catch {
    return false;
  }
}
function isWebUrl(rawUrl) {
  try {
    const { protocol } = new URL(rawUrl);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
// openExternal rejects when no handler exists (e.g. VS Code not installed); never leave that unhandled
function openExternalSafe(url) {
  return shell.openExternal(url).then(
    () => true,
    (err) => {
      console.error('[shell] openExternal failed:', err.message);
      return false;
    }
  );
}

// Privileged IPC: only from our app page, in the main frame of the main window (not an iframe)
function isTrustedSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
  const frame = event.senderFrame;
  return Boolean(frame && frame === mainWindow.webContents.mainFrame && isAppUrl(frame.url));
}

// ---- Single instance: a second launch (e.g. by a flowmate:// link) hands over to the running one ----
// Must come first so a second process never touches the protocol registry, userData or windows.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

// ---- Auth (token lives only in this process, see auth.cjs) ----
const auth = createAuth({
  isDev,
  appRoot: path.join(__dirname, '..'),
  getMainWebContents: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null),
});

// Login results waiting for the renderer to finish loading
let pendingAuthResult = null;
function deliverAuthResult(result) {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('auth:result', result);
  } else {
    pendingAuthResult = result;
  }
}

// ---- flowmate:// deep link (GitHub OAuth callback) ----
const PROTOCOL = 'flowmate';

if (!gotSingleInstanceLock) {
  // second process: quitting, register nothing
} else if (process.defaultApp && process.argv.length >= 2) {
  // Dev run (electron electron/main.cjs): the OS must launch electron with our script path
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Only the OAuth callback is accepted; any other flowmate:// link is dropped.
// (Whether a login was actually started is checked in auth.handleCallback.)
const OAUTH_CALLBACK_PREFIX = `${PROTOCOL}://oauth/callback`;
const isOAuthCallback = (a) =>
  typeof a === 'string' &&
  a.length <= 8192 &&
  (a === OAUTH_CALLBACK_PREFIX || a.startsWith(`${OAUTH_CALLBACK_PREFIX}?`) || a.startsWith(`${OAUTH_CALLBACK_PREFIX}/?`));
const findDeepLink = (argv) => argv.find(isOAuthCallback);

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function handleDeepLink(url) {
  if (!isOAuthCallback(url)) return;
  focusMainWindow();
  // The renderer only ever learns ok/error, never the token
  auth
    .handleCallback(url)
    .then((result) => result && deliverAuthResult(result))
    .catch((err) => console.error('[auth] callback failed:', err));
}

// Windows/Linux: a second launch passes its argv (maybe a flowmate:// link) to this instance.
// Always bring the window forward, link or not (e.g. the user just double-clicked the icon again).
app.on('second-instance', (_event, argv) => {
  focusMainWindow();
  handleDeepLink(findDeepLink(argv));
});
// macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});
// A cold start via a flowmate:// link can't be a login this process started, so argv links are not processed.

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
    if (isWebUrl(url)) openExternalSafe(url);
    // Never open other schemes (file:, javascript:, custom protocols) inside an Electron window
    return { action: 'deny' };
  });

  // The main window must only ever show the app itself (this also blocks files dropped on the window);
  // web links go to the system browser. Redirects are checked too.
  const keepInApp = (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (isWebUrl(url)) openExternalSafe(url);
  };
  mainWindow.webContents.on('will-navigate', keepInApp);
  mainWindow.webContents.on('will-redirect', keepInApp);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingAuthResult) {
      mainWindow.webContents.send('auth:result', pendingAuthResult);
      pendingAuthResult = null;
    }
  });

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

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  // Restore the encrypted session and install the auth header hook before the app makes any request.
  // auth.ready never rejects (failures degrade to "logged out"), but never let it keep the window from opening.
  await auth.ready.catch((err) => console.error('[auth] init failed:', err));
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
  ipcMain.on('show-notification', (event, payload) => {
    if (!isTrustedSender(event) || !Notification.isSupported()) return;
    // The payload comes from the renderer: never destructure or trust it blindly
    const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const title = text(payload && payload.title, 120) || 'FlowMate';
    const body = text(payload && payload.body, 500);
    try {
      new Notification({ title, body }).show();
    } catch (err) {
      console.error('[notification] failed:', err.message);
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
        openExternalSafe(url);
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

  // Auth: the renderer can ask whether it is logged in, start a login, or log out. It can never read the token.
  ipcMain.handle('auth:get-state', async (event) => {
    if (!isTrustedSender(event)) return { loggedIn: false, apiConfigured: false };
    return auth.getState();
  });
  ipcMain.handle('auth:start-login', async (event) => {
    if (!isTrustedSender(event)) return { ok: false, message: '허용되지 않은 요청입니다.' };
    return auth.startLogin();
  });
  ipcMain.handle('auth:clear', async (event) => {
    if (!isTrustedSender(event)) return;
    await auth.clear();
  });

  ipcMain.on('window-minimize', (event) => {
    if (!isTrustedSender(event)) return;
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    if (!isTrustedSender(event)) return;
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    if (!isTrustedSender(event)) return;
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
