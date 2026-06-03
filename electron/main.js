const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, screen, dialog } = require('electron');
const path = require('path');

// Disable hardware acceleration to prevent GPU crashes in restricted/virtual environments
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Disable autoplay policy globally in Chromium to allow audio without user interaction
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const dotenv = require('dotenv');

let mainWindow = null;
let bellWindow = null;
let tray = null;
let serverProcess = null;
const isDev = !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Goodrest — Owner Dashboard',
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadURL('http://localhost:3000/admin/orders');

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createBellWindow() {
  bellWindow = new BrowserWindow({
    width: 400,
    height: 300,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  bellWindow.loadFile(path.join(__dirname, 'bell.html'));

  bellWindow.on('closed', () => {
    bellWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Dashboard', click: () => mainWindow?.show() },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('Goodrest Owner Dashboard');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // Dev: assume next dev is running externally, just check readiness
      waitForReady().then(resolve).catch(reject);
      return;
    }

    // Prod: resolve paths based on packaged vs dev mode
    const basePath = app.isPackaged
      ? path.join(path.dirname(app.getAppPath()), 'app.asar.unpacked', 'electron')
      : __dirname;
    const standaloneDir = path.join(basePath, '.next', 'standalone');
    const serverScript = path.join(standaloneDir, 'server.js');

    // Load .env — from extraResources in packaged mode, from project root in dev
    const envFile = app.isPackaged
      ? path.join(process.resourcesPath, '.env')
      : path.join(__dirname, '..', '.env');
    const envVars = fs.existsSync(envFile)
      ? dotenv.parse(fs.readFileSync(envFile))
      : {};

    serverProcess = spawn(process.execPath, [serverScript], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        ...envVars,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (d) => console.log(`[next] ${d.toString().trim()}`));
    serverProcess.stderr.on('data', (d) => console.error(`[next] ${d.toString().trim()}`));
    serverProcess.on('error', (err) => reject(new Error(`Server start failed: ${err.message}`)));
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    waitForReady().then(resolve).catch(reject);
  });
}

function waitForReady(port = 3000, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server did not start within ${timeout / 1000}s`));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.removeAllListeners('exit');
    serverProcess.kill();
    serverProcess = null;
  }
}

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('show-bell-window', (event, orderData) => {
  if (!bellWindow) createBellWindow();

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  bellWindow.setPosition(width - 420, height - 320);
  bellWindow.show();

  bellWindow.webContents.send('new-order', orderData);
});

ipcMain.on('hide-bell-window', () => {
  if (bellWindow) {
    bellWindow.webContents.send('stop-ringing-bell');
    bellWindow.hide();
  }
});

ipcMain.on('update-tray-badge', (event, count) => {
  if (tray) {
    tray.setToolTip(count > 0 ? `Goodrest — ${count} pending orders` : 'Goodrest Owner Dashboard');
  }
});

ipcMain.on('play-notification-sound', () => {
  if (Notification.isSupported()) {
    new Notification({
      title: 'New Order!',
      body: 'A new order has arrived. Accept within 5 minutes.',
      urgency: 'critical',
    }).show();
  }
});

ipcMain.on('accept-order', (event, orderData) => {
  // Forward accept to main window's web content
  mainWindow?.webContents.send('accept-order-from-bell', orderData);
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', err);
    dialog.showErrorBox('Startup Error', `Failed to start backend server:\n${err.message}`);
    app.quit();
    return;
  }

  createMainWindow();
  createTray();

  // Test sequence: Automatically trigger the bell window with sound 5 seconds after launch to verify audio
  setTimeout(() => {
    console.log('🔔 Dev Trigger: Simulating incoming order for audio/UI test...');
    const testOrder = {
      customer_name: 'Direct Audio Test',
      items_summary: '2x Double Cheese Margherita, 1x Stuffed Garlic Bread, 1x Choco Lava Cake',
      total_amount: 580
    };
    
    if (!bellWindow) createBellWindow();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    bellWindow.setPosition(width - 420, height - 320);
    bellWindow.show();

    bellWindow.webContents.send('new-order', testOrder);
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopServer();
});
