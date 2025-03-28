/**
 * @fileoverview Main Electron process that handles window management, IPC communication,
 * and core application functionality.
 * 
 * Features:
 * - Window management (create, control, state)
 * - IPC communication with renderer
 * - System tray integration
 * - Global shortcuts
 * - Export functionality (Markdown, HTML, PDF)
 * - Documentation viewer
 * - Font management
 * - Memory management
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const https = require('https');
const { marked } = require('marked');

// Global references to prevent garbage collection
let mainWindow;
let tray;
let syncEnabled = true; // Default to enabled
let syncStatusInterval;
let isWindowDestroyed = false; // Track window destroyed state

// Register IPC handlers that should only be registered once
ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized();
});

// Add platform detection handler
ipcMain.handle('platform:get', () => {
  return process.platform;
});

// Handle menu actions from the renderer process
ipcMain.handle('menu-action', async (event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  switch (action) {
    case 'new':
      mainWindow.webContents.send('create-new-snippet');
      break;
    case 'import':
      mainWindow.webContents.send('open-import-dialog');
      break;
    case 'export-markdown':
      mainWindow.webContents.send('export-snippet', 'markdown');
      break;
    case 'export-html':
      mainWindow.webContents.send('export-snippet', 'html');
      break;
    case 'export-pdf':
      mainWindow.webContents.send('export-snippet', 'pdf');
      break;
    case 'toggle-theme':
      mainWindow.webContents.send('toggle-theme');
      break;
    case 'settings':
      mainWindow.webContents.send('open-settings');
      break;
    case 'command-palette':
      mainWindow.webContents.send('menu-action', 'command-palette');
      break;
    case 'keyboard-shortcuts':
      mainWindow.webContents.send('menu-action', 'keyboard-shortcuts');
      break;
    case 'documentation':
      openDocumentation();
      break;
    case 'about':
      mainWindow.webContents.send('menu-action', 'about');
      break;
    // Add other menu actions as needed
  }
  
  return { success: true };
});

/**
 * Creates and configures the main application window
 * Sets up event listeners, IPC handlers, and platform-specific behaviors
 */
function createWindow() {
  isWindowDestroyed = false;
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    frame: false, // Remove default frame for all platforms
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', // Use hiddenInset for macOS, hidden for others
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Memory management settings
      webPreferences: {
        v8CacheOptions: 'none', // Disable code caching to reduce memory
        backgroundThrottling: true, // Enable background throttling
      }
    },
    // Add memory limits
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Set memory limits
      javascript: {
        memoryLimit: 512 // Limit to 512MB
      }
    },
    icon: path.join(__dirname, isDev ? '../public/favicon.ico' : 'favicon.ico'),
  });

  // Set additional memory management options
  mainWindow.webContents.setBackgroundThrottling(true);
  
  // Add garbage collection trigger on hide
  mainWindow.on('hide', () => {
    clearSyncInterval();
    if (global.gc) {
      try {
        global.gc();
      } catch (e) {
        console.error('Failed to trigger GC:', e);
      }
    }
  });

  // Add periodic garbage collection
  const gcInterval = setInterval(() => {
    if (global.gc && !isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
      try {
        global.gc();
      } catch (e) {
        console.error('Failed to trigger periodic GC:', e);
      }
    }
  }, 300000); // Run every 5 minutes

  // Clear GC interval on window close
  mainWindow.on('closed', () => {
    isWindowDestroyed = true;
    clearSyncInterval();
    clearInterval(gcInterval);
    mainWindow = null;
  });

  // Remove the native menu for Windows/Linux, but create it for macOS
  if (process.platform === 'darwin') {
    // Create a native menu for macOS
    const macTemplate = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'File',
        submenu: [
          { 
            label: 'New Snippet',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('create-new-snippet');
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Import...',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('open-import-dialog');
              }
            }
          },
          {
            label: 'Export',
            submenu: [
              {
                label: 'Markdown (.md)',
                click: () => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('export-snippet', 'markdown');
                  }
                }
              },
              {
                label: 'HTML (.html)',
                click: () => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('export-snippet', 'html');
                  }
                }
              },
              {
                label: 'PDF (.pdf)',
                click: () => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('export-snippet', 'pdf');
                  }
                }
              }
            ]
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Command Palette',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-action', 'command-palette');
              }
            }
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Keyboard Shortcuts',
            accelerator: 'F1',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-action', 'keyboard-shortcuts');
              }
            }
          },
          {
            label: 'Documentation',
            click: () => {
              openDocumentation();
            }
          },
          { type: 'separator' },
          {
            label: 'About CodexPad',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('menu-action', 'about');
              }
            }
          }
        ]
      },
      {
        role: 'window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'close' }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(macTemplate);
    Menu.setApplicationMenu(menu);
  } else {
    // Remove the native menu for Windows/Linux
    Menu.setApplicationMenu(null);
  }

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Window control events
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize-restore', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  // Window state events
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-unmaximized');
  });

  // Window events
  mainWindow.on('closed', () => {
    isWindowDestroyed = true;
    clearSyncInterval();
    mainWindow = null;
  });

  mainWindow.on('hide', () => {
    clearSyncInterval();
  });

  // Set up show listener to restart sync interval
  mainWindow.on('show', () => {
    if (syncEnabled && !syncStatusInterval && !isWindowDestroyed) {
      setupSyncStatusInterval();
    }
  });

  // Wait for window to be ready before setting up sync status
  mainWindow.webContents.on('did-finish-load', () => {
    if (syncEnabled && !syncStatusInterval && !isWindowDestroyed) {
      setupSyncStatusInterval();
    }
  });

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Initialize system tray
  createTray();

  // Setup global shortcut
  setupGlobalShortcut();
}

/**
 * Creates and configures the system tray icon and menu
 * Provides quick access to app functions and sync toggle
 */
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

/**
 * Sets up global keyboard shortcuts for the application
 * Currently registers Ctrl+Shift+Space for show/hide
 */
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

// Helper function to clear sync interval
function clearSyncInterval() {
  if (syncStatusInterval) {
    clearInterval(syncStatusInterval);
    syncStatusInterval = null;
  }
}

// Send sync status updates to renderer with improved checks
function updateSyncStatus() {
  // Skip update if window is destroyed or hidden
  if (isWindowDestroyed || !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    clearSyncInterval();
    return;
  }

  try {
    // Only send update if sync service exists and window is ready
    if (syncService && !mainWindow.webContents.isLoading()) {
      const status = {
        connected: syncEnabled && syncService.isConnectedToServer(),
        pendingChanges: syncEnabled ? (syncService.pendingChanges?.length || 0) : 0
      };
      
      // Final check before sending
      if (!isWindowDestroyed && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('sync:connection-status', status);
      }
    }
  } catch (error) {
    console.error('Error updating sync status:', error);
    clearSyncInterval();
  }
}

// Setup sync status interval with memory-conscious settings
function setupSyncStatusInterval() {
  clearSyncInterval();
  
  // Use a longer interval (15 seconds) to reduce memory pressure
  // Only set up if window is valid
  if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
    syncStatusInterval = setInterval(updateSyncStatus, 15000);
  }
}

/**
 * Downloads a file from a URL to a local destination
 * @param {string} url - Source URL to download from
 * @param {string} dest - Local destination path
 * @returns {Promise<void>}
 */
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

/**
 * Sets up custom fonts for the application
 * Downloads and manages font files in user data directory
 */
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
  // Enable garbage collection
  app.commandLine.appendSwitch('js-flags', '--expose-gc');
  
  // Import services here to ensure app is ready
  snippetService = require('../src/services/snippetService');
  syncService = require('../src/services/syncService');
  
  // Initialize sync service if enabled
  if (syncEnabled) {
    syncService.initialize();
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
  // Clear sync status interval
  if (syncStatusInterval) {
    clearInterval(syncStatusInterval);
    syncStatusInterval = null;
  }
  
  // Trigger garbage collection
  if (global.gc) {
    try {
      global.gc();
    } catch (e) {
      console.error('Failed to trigger GC on window close:', e);
    }
  }
  
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
  // Clear all intervals
  clearSyncInterval();
  
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
  
  // Log the creation if sync is enabled
  if (syncEnabled) {
    syncService.log('info', `Created new snippet #${id}`, `Title: ${title}`);
  }
  
  return { id, title, content, tags };
});

ipcMain.handle('snippets:update', async (event, snippet) => {
  snippetService.updateSnippet(
    snippet.id, 
    snippet.title, 
    snippet.content, 
    snippet.tags,
    snippet.favorite || false
  );
  
  // Push to sync server if sync is enabled
  if (syncEnabled) {
    syncService.pushSnippet(snippet);
    syncService.log('info', `Saved snippet #${snippet.id}`, `Title: ${snippet.title}`);
  }
  
  return true;
});

ipcMain.handle('snippets:delete', async (event, id) => {
  snippetService.deleteSnippet(id);
  
  // Log the deletion if sync is enabled
  if (syncEnabled) {
    syncService.log('info', `Deleted snippet #${id}`);
  }
  
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

// Add ipcMain handler for manual backup
ipcMain.handle('sync:backup', async () => {
  if (!syncEnabled) {
    return { success: false, error: 'Sync is disabled' };
  }
  
  if (!syncService.isConnectedToServer()) {
    return { success: false, error: 'Not connected to server' };
  }

  try {
    // Get server URL from sync service config
    const serverUrl = syncService.getServerUrl();
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    // Make a POST request to the backup endpoint
    const response = await fetch(`${serverUrl}/backup`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `Server returned error (${response.status}): ${errorText}` 
      };
    }

    const result = await response.json();
    
    // Add to sync log
    syncService.log('info', 'Manual backup created', result.message);
    
    return { 
      success: true, 
      message: result.message || 'Backup created successfully' 
    };
  } catch (error) {
    console.error('Failed to trigger backup:', error);
    
    // Add to sync log
    syncService.log('error', 'Manual backup failed', error.message);
    
    return { 
      success: false, 
      error: error.message || 'Unknown error during backup' 
    };
  }
});

// Add export handlers after the other ipcMain handlers
// Export to Markdown
ipcMain.handle('export:markdown', async (event, snippet) => {
  try {
    // Generate markdown content
    let markdown = `# ${snippet.title}\n\n`;
    
    if (snippet.tags && snippet.tags.length > 0) {
      markdown += `Tags: ${snippet.tags.join(', ')}\n\n`;
    }
    
    markdown += snippet.content;
    
    // Get safe filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const safeTitle = snippet.title.replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled';
    const suggestedFilename = `${safeTitle}_${dateStr}.md`;
    
    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export as Markdown',
      defaultPath: path.join(app.getPath('documents'), suggestedFilename),
      filters: [
        { name: 'Markdown Files', extensions: ['md'] }
      ]
    });
    
    if (canceled || !filePath) {
      return { success: false, message: 'Export cancelled' };
    }
    
    // Write to file
    fs.writeFileSync(filePath, markdown, 'utf8');
    
    return { success: true, message: 'Exported successfully', filePath };
  } catch (error) {
    console.error('Failed to export as Markdown:', error);
    return { success: false, error: error.message };
  }
});

// Export to HTML
ipcMain.handle('export:html', async (event, snippet) => {
  try {
    // Generate markdown content first
    let markdown = `# ${snippet.title}\n\n`;
    
    if (snippet.tags && snippet.tags.length > 0) {
      markdown += `Tags: ${snippet.tags.join(', ')}\n\n`;
    }
    
    markdown += snippet.content;
    
    // Convert to HTML
    const htmlContent = marked(markdown);
    
    // Create full HTML document
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${snippet.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 20px;
      margin-left: 0;
      color: #666;
    }
    img {
      max-width: 100%;
    }
    .tags {
      color: #666;
      font-style: italic;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
    
    // Get safe filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const safeTitle = snippet.title.replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled';
    const suggestedFilename = `${safeTitle}_${dateStr}.html`;
    
    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export as HTML',
      defaultPath: path.join(app.getPath('documents'), suggestedFilename),
      filters: [
        { name: 'HTML Files', extensions: ['html'] }
      ]
    });
    
    if (canceled || !filePath) {
      return { success: false, message: 'Export cancelled' };
    }
    
    // Write to file
    fs.writeFileSync(filePath, fullHtml, 'utf8');
    
    return { success: true, message: 'Exported successfully', filePath };
  } catch (error) {
    console.error('Failed to export as HTML:', error);
    return { success: false, error: error.message };
  }
});

// Export to PDF
ipcMain.handle('export:pdf', async (event, snippet) => {
  try {
    // Get safe filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const safeTitle = snippet.title.replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled';
    const suggestedFilename = `${safeTitle}_${dateStr}.pdf`;
    
    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export as PDF',
      defaultPath: path.join(app.getPath('documents'), suggestedFilename),
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (canceled || !filePath) {
      return { success: false, message: 'Export cancelled' };
    }
    
    // Create a hidden browser window for PDF generation
    const pdfWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Generate markdown content
    let markdown = `# ${snippet.title}\n\n`;
    
    if (snippet.tags && snippet.tags.length > 0) {
      markdown += `Tags: ${snippet.tags.join(', ')}\n\n`;
    }
    
    markdown += snippet.content;
    
    // Convert to HTML
    const htmlContent = marked(markdown);
    
    // Create full HTML document with print-friendly styles
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${snippet.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 20px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 20px;
      margin-left: 0;
      color: #666;
    }
    img {
      max-width: 100%;
    }
    .tags {
      color: #666;
      font-style: italic;
      margin-bottom: 20px;
    }
    @media print {
      body {
        padding: 0;
      }
      pre {
        page-break-inside: avoid;
      }
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Create a temporary HTML file
    const tempHtmlPath = path.join(app.getPath('temp'), `${safeTitle}_temp.html`);
    fs.writeFileSync(tempHtmlPath, fullHtml, 'utf8');
    
    // Load the HTML file
    await pdfWindow.loadFile(tempHtmlPath);
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate PDF
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4
      },
      pageSize: 'A4'
    });
    
    // Write PDF to file
    fs.writeFileSync(filePath, pdfData);
    
    // Clean up
    pdfWindow.destroy();
    
    // Remove temp HTML file
    try {
      fs.unlinkSync(tempHtmlPath);
    } catch (err) {
      console.warn('Failed to delete temporary HTML file:', err);
    }
    
    return { success: true, message: 'Exported successfully', filePath };
  } catch (error) {
    console.error('Failed to export as PDF:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Opens the documentation viewer in a new window
 * Supports markdown rendering and theme synchronization
 */
function openDocumentation() {
  // Create documentation window
  let docWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'CodexPad Documentation',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  // Function to load a documentation file
  const loadDocFile = async (filename) => {
    try {
      const docsPath = path.join(app.getAppPath(), isDev ? 'docs' : '../docs');
      const filePath = path.join(docsPath, filename);
      
      if (!fs.existsSync(filePath)) {
        return docWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<h1>File Not Found</h1><p>The requested documentation file could not be found.</p>')}`);
      }
      
      const markdownContent = fs.readFileSync(filePath, 'utf8');
      
      // Get the current theme directly from the main window
      const themeData = await mainWindow.webContents.executeJavaScript(`
        ({
          htmlClasses: document.documentElement.className,
          htmlDataTheme: document.documentElement.dataset.theme || '',
          allStyles: Array.from(document.head.querySelectorAll('style'))
            .map(style => style.textContent)
            .join('\\n')
        })
      `);
      
      // Generate HTML content
      const renderer = new marked.Renderer();
      
      // Fix anchor links
      renderer.heading = function(text, level) {
        const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
        return '<h' + level + ' id="' + escapedText + '">' + text + '</h' + level + '>';
      };
      
      // Convert markdown to HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html class="${themeData.htmlClasses}" ${themeData.htmlDataTheme ? `data-theme="${themeData.htmlDataTheme}"` : ''}>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CodexPad Documentation</title>
          <style>
            ${themeData.allStyles}
            
            /* Additional styles specific to documentation */
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
              height: calc(100vh - 40px);
              overflow-y: auto;
            }
            
            pre, code {
              border-radius: 3px;
              padding: 0.2em 0.4em;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            }
            
            pre {
              padding: 16px;
              overflow: auto;
            }
            
            pre code {
              padding: 0;
            }
            
            blockquote {
              border-left: 4px solid var(--border-color, #ddd);
              padding-left: 16px;
              margin: 0 0 16px 0;
            }
            
            img {
              max-width: 100%;
            }
            
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 16px 0;
            }
            
            th, td {
              padding: 8px;
              text-align: left;
            }
            
            /* Scrollbar styling */
            ::-webkit-scrollbar {
              width: 10px;
              height: 10px;
            }
            
            ::-webkit-scrollbar-track {
              background: var(--editor-bg, #f1f1f1);
            }
            
            ::-webkit-scrollbar-thumb {
              background: var(--text-light, #888);
              border-radius: 5px;
              border: 2px solid var(--editor-bg, #f1f1f1);
            }
            
            ::-webkit-scrollbar-thumb:hover {
              background: var(--text-color, #555);
            }
          </style>
        </head>
        <body>
          ${marked(markdownContent, { renderer })}
          <script>
            // Use an IIFE to avoid variable leaks to global scope
            (function() {
              // Handle link clicks - use a delegated event listener
              document.addEventListener('click', (event) => {
                const linkElement = event.target.closest('a');
                if (!linkElement) return;
                
                const href = linkElement.getAttribute('href');
                if (!href) return;
                
                // Handle anchor links
                if (href.startsWith('#')) {
                  event.preventDefault();
                  const targetElement = document.getElementById(href.substring(1));
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                  }
                  return;
                }
                
                // Handle markdown file links
                if (href.endsWith('.md')) {
                  event.preventDefault();
                  window.location.href = 'codexpad://load-doc?file=' + encodeURIComponent(href);
                }
              });
            })();
          </script>
        </body>
        </html>
      `;
      
      // Load the HTML content
      return docWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    } catch (error) {
      console.error('Error loading documentation:', error);
      return docWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<h1>Error</h1><p>Failed to load documentation: ' + error.message + '</p>')}`);
    }
  };

  // Register protocol for docs navigation
  if (!app.isDefaultProtocolClient('codexpad')) {
    app.setAsDefaultProtocolClient('codexpad');
  }

  // Handle protocol requests for doc links
  app.on('open-url', (event, url) => {
    event.preventDefault();
    
    if (url.startsWith('codexpad://load-doc')) {
      const fileParam = new URL(url).searchParams.get('file');
      if (fileParam && docWindow && !docWindow.isDestroyed()) {
        loadDocFile(fileParam);
      }
    }
  });

  // Register a custom protocol handler for internal navigation
  protocol.registerHttpProtocol('codexpad', (request, callback) => {
    const url = new URL(request.url);
    
    if (url.pathname === '/load-doc' && url.searchParams.has('file')) {
      const fileParam = url.searchParams.get('file');
      loadDocFile(fileParam);
    }
  });

  // Listen for navigation events
  docWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('codexpad://')) {
      event.preventDefault();
      const fileParam = new URL(url).searchParams.get('file');
      if (fileParam) {
        loadDocFile(fileParam);
      }
    }
  });

  // Initial load of index.md
  loadDocFile('index.md');

  // Emitted when the window is closed
  docWindow.on('closed', () => {
    docWindow = null;
  });
}

// Remove the load-doc-file IPC handler since we're using protocol-based navigation
ipcMain.handle('load-doc-file', async (event, filename) => {
  const docsPath = path.join(app.getAppPath(), isDev ? 'docs' : '../docs');
  const filePath = path.join(docsPath, filename);
  
  if (fs.existsSync(filePath)) {
    return filename; // Just return the filename for logging
  } else {
    return null;
  }
});
