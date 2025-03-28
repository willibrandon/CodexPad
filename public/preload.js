/**
 * @fileoverview Preload script that securely exposes Electron APIs to the renderer process
 * Implements a secure bridge between main and renderer processes using contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');
const { platform } = process;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    platform: platform,
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
        'platform:get',
        'menu-action',
        'toggle-theme',
        'open-settings',
        'load-doc-file'
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
        'export-snippet',
        'toggle-theme',
        'open-settings',
        'menu-action'
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
        'export-snippet',
        'toggle-theme',
        'open-settings'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
    // Add fonts path getter
    getFontsPath: () => ipcRenderer.invoke('get-fonts-path'),
  }
);
