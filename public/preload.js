const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    invoke: (channel, ...args) => {
      // Whitelist channels that can be invoked
      const validChannels = [
        'snippets:getAll', 
        'snippets:create', 
        'snippets:update', 
        'snippets:delete', 
        'snippets:search',
        'sync:push',
        'sync:pull',
        'sync:status',
        'sync:toggle',
        'sync:getLogEntries',
        'sync:backup',
        'get-fonts-path',
        'export:markdown',
        'export:html',
        'export:pdf',
        'window:isMaximized',
        'menu-action'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
    },
    send: (channel, ...args) => {
      // Whitelist channels that can be sent
      const validChannels = [
        'window:minimize',
        'window:maximize-restore',
        'window:close'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    receive: (channel, func) => {
      const validChannels = [
        'create-new-snippet', 
        'sync:update', 
        'sync:connection-status',
        'sync:log-entry',
        'window-maximized',
        'window-unmaximized',
        'open-import-dialog',
        'export-snippet'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    removeAllListeners: (channel) => {
      const validChannels = [
        'create-new-snippet', 
        'sync:update', 
        'sync:connection-status',
        'sync:log-entry',
        'window-maximized',
        'window-unmaximized',
        'open-import-dialog',
        'export-snippet'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
    // Add fonts path getter
    getFontsPath: () => ipcRenderer.invoke('get-fonts-path'),
  }
);
