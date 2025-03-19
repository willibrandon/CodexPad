const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const https = require('https');

// Global references to prevent garbage collection
let mainWindow;
let tray;
let syncEnabled = true; // Default to enabled

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, isDev ? '../public/favicon.ico' : 'favicon.ico'),
  });

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Window events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // Initialize system tray
  createTray();

  // Setup global shortcut
  setupGlobalShortcut();
}

function createTray() {
  // Use PNG format which works better across platforms
  const iconPath = path.join(__dirname, isDev ? 'logo192.png' : 'logo192.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open CodexPad', 
      click: () => { 
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      } 
    },
    { 
      label: 'New Snippet', 
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
        mainWindow.webContents.send('create-new-snippet');
      } 
    },
    { type: 'separator' },
    { 
      label: 'Sync Enabled',
      type: 'checkbox',
      checked: syncEnabled,
      click: () => {
        syncEnabled = !syncEnabled;
        if (syncEnabled) {
          syncService.initialize();
        } else {
          syncService.disconnect();
        }
        updateSyncStatus();
      }
    },
    { type: 'separator' },
    { 
      label: 'Exit', 
      click: () => { 
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('CodexPad');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function setupGlobalShortcut() {
  // Register global shortcut (Ctrl+Shift+Space)
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });

  if (!shortcutRegistered) {
    console.log('Global shortcut registration failed');
  }
}

// Initialize services when the app is ready
let snippetService;
let syncService;

// Send sync status updates to renderer
function updateSyncStatus() {
  if (mainWindow) {
    const status = {
      connected: syncEnabled && syncService.isConnectedToServer(),
      pendingChanges: syncEnabled ? (syncService.pendingChanges ? syncService.pendingChanges.length : 0) : 0,
      lastSyncedAt: syncEnabled ? null : null // TODO: Track last sync timestamp
    };
    
    mainWindow.webContents.send('sync:connection-status', status);
  }
}

// Function to download file from URL to destination
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, response => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(dest);
      reject(err);
    });
  });
}

// Check and download fonts when the app starts
async function setupFonts() {
  const userDataPath = app.getPath('userData');
  const fontsDir = path.join(userDataPath, 'fonts');
  
  // Create fonts directory if it doesn't exist
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }
  
  const fonts = [
    {
      name: 'FiraCode-Regular.woff2',
      url: 'https://cdn.jsdelivr.net/npm/firacode@6.2.0/distr/woff2/FiraCode-Regular.woff2'
    },
    {
      name: 'JetBrainsMono-Regular.woff2',
      url: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/webfonts/JetBrainsMono-Regular.woff2'
    },
    {
      name: 'CascadiaCode-Regular.woff2',
      url: 'https://cdn.jsdelivr.net/gh/microsoft/cascadia-code@main/fonts/CascadiaCode-Regular.woff2'
    }
  ];
  
  // Check and download each font if needed
  for (const font of fonts) {
    const fontPath = path.join(fontsDir, font.name);
    
    if (!fs.existsSync(fontPath)) {
      try {
        console.log(`Downloading font: ${font.name}`);
        await downloadFile(font.url, fontPath);
        console.log(`Downloaded font: ${font.name}`);
      } catch (error) {
        console.error(`Error downloading font ${font.name}:`, error);
      }
    }
  }
  
  // Pass the fonts directory path to the renderer process
  global.fontsPath = fontsDir;
}

app.whenReady().then(() => {
  // Import services here to ensure app is ready
  snippetService = require('../src/services/snippetService');
  syncService = require('../src/services/syncService');
  
  // Initialize sync service if enabled
  if (syncEnabled) {
    syncService.initialize();
    
    // Set up periodic sync status updates
    setInterval(updateSyncStatus, 5000);
  }
  
  setupFonts().catch(err => console.error('Error setting up fonts:', err));
  
  // Add IPC handler for font paths
  ipcMain.handle('get-fonts-path', () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'fonts');
  });
  
  createWindow();
});

// Handle app events
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  
  // Clean up sync service
  if (syncService) {
    syncService.disconnect();
  }
});

// IPC handlers for database operations
ipcMain.handle('snippets:getAll', async () => {
  return snippetService.getAllSnippets();
});

ipcMain.handle('snippets:create', async (event, title, content, tags) => {
  const id = snippetService.createSnippet(title, content, tags);
  return { id, title, content, tags };
});

ipcMain.handle('snippets:update', async (event, snippet) => {
  snippetService.updateSnippet(snippet.id, snippet.title, snippet.content, snippet.tags);
  
  // Push to sync server if sync is enabled
  if (syncEnabled) {
    syncService.pushSnippet(snippet);
  }
  
  return true;
});

ipcMain.handle('snippets:delete', async (event, id) => {
  snippetService.deleteSnippet(id);
  return true;
});

ipcMain.handle('snippets:search', async (event, term) => {
  return snippetService.searchSnippets(term);
});

// IPC handlers for sync operations
ipcMain.handle('sync:push', async (event, snippet) => {
  if (!syncEnabled) return { success: false, error: 'Sync is disabled' };
  
  try {
    syncService.pushSnippet(snippet);
    return { success: true };
  } catch (error) {
    console.error('Failed to push snippet to sync server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:pull', async (event, snippetId) => {
  if (!syncEnabled) return { success: false, error: 'Sync is disabled' };
  
  try {
    syncService.pullSnippet(snippetId);
    return { success: true };
  } catch (error) {
    console.error('Failed to pull snippet from sync server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:status', async () => {
  return {
    enabled: syncEnabled,
    connected: syncEnabled && syncService.isConnectedToServer(),
    pendingChanges: syncEnabled ? (syncService.pendingChanges ? syncService.pendingChanges.length : 0) : 0
  };
});

ipcMain.handle('sync:toggle', async (event, enable) => {
  syncEnabled = enable !== undefined ? enable : !syncEnabled;
  
  if (syncEnabled) {
    syncService.initialize();
  } else {
    syncService.disconnect();
  }
  
  updateSyncStatus();
  
  return { enabled: syncEnabled };
});

ipcMain.handle('sync:getLogEntries', async () => {
  if (!syncEnabled || !syncService) return [];
  return syncService.getLogEntries();
});
