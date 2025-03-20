const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog } = require('electron');
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

// Register IPC handlers that should only be registered once
ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized();
});

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    frame: false,  // Remove default window frame
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, isDev ? '../public/favicon.ico' : 'favicon.ico'),
  });

  // Remove the native menu
  Menu.setApplicationMenu(null);

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

  // Wait for window to be ready before setting up sync status
  mainWindow.webContents.on('did-finish-load', () => {
    if (syncEnabled && !syncStatusInterval) {
      syncStatusInterval = setInterval(updateSyncStatus, 5000);
    }
  });

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Window events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up show listener to restart sync interval
  mainWindow.on('show', () => {
    if (syncEnabled && !syncStatusInterval) {
      syncStatusInterval = setInterval(updateSyncStatus, 5000);
    }
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
  // Check if window exists and isn't destroyed
  if (!mainWindow || mainWindow.isDestroyed()) {
    // Clear interval if window is gone
    if (syncStatusInterval) {
      clearInterval(syncStatusInterval);
      syncStatusInterval = null;
    }
    return;
  }

  // Skip updates if window is not visible
  if (!mainWindow.isVisible()) {
    return;
  }

  try {
    // Additional check for webContents
    if (!mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
      if (syncStatusInterval) {
        clearInterval(syncStatusInterval);
        syncStatusInterval = null;
      }
      return;
    }

    const status = {
      connected: syncEnabled && syncService.isConnectedToServer(),
      pendingChanges: syncEnabled ? (syncService.pendingChanges ? syncService.pendingChanges.length : 0) : 0,
      lastSyncedAt: syncEnabled ? null : null // TODO: Track last sync timestamp
    };
    
    mainWindow.webContents.send('sync:connection-status', status);
  } catch (error) {
    console.error('Error updating sync status:', error);
    // Clear interval on error to prevent spam
    if (syncStatusInterval) {
      clearInterval(syncStatusInterval);
      syncStatusInterval = null;
    }
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
    syncService.logEvent('info', 'Manual backup created', result.message);
    
    return { 
      success: true, 
      message: result.message || 'Backup created successfully' 
    };
  } catch (error) {
    console.error('Failed to trigger backup:', error);
    
    // Add to sync log
    syncService.logEvent('error', 'Manual backup failed', error.message);
    
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
