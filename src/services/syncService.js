const { Worker } = require('worker_threads');
const path = require('path');
const uuid = require('uuid');
const snippetService = require('./snippetService');
const db = require('./db');
const { BrowserWindow } = require('electron');

class SyncService {
  constructor() {
    this.isConnected = false;
    this.pendingChanges = [];
    this.worker = null;
    this.statusListeners = new Set();
    this.clientId = null;
    this.serverUrl = process.env.SYNC_SERVER_URL || 'ws://localhost:8080/sync';
    this.logEntries = [];
    this.maxLogEntries = 1000;
  }

  // Initialize the sync service
  initialize() {
    // Load or generate client ID
    this.clientId = db.get('clientId');
    if (!this.clientId) {
      this.clientId = uuid.v4();
      db.set('clientId', this.clientId);
      this.log('info', 'Generated new client ID', `Client ID: ${this.clientId}`);
    } else {
      this.log('info', 'Using existing client ID', `Client ID: ${this.clientId}`);
    }

    // Create and initialize worker
    this.setupWorker();
    
    // Load any stored log entries
    const storedLogs = db.get('syncLog') || [];
    this.logEntries = storedLogs.slice(-this.maxLogEntries);
  }

  setupWorker() {
    if (this.worker) {
      this.worker.terminate();
    }

    this.worker = new Worker(path.join(__dirname, '../../public/syncWorker.js'));

    // Handle messages from worker
    this.worker.on('message', (message) => {
      switch (message.type) {
        case 'status':
          this.handleStatusUpdate(message.status);
          break;
        case 'snippetUpdate':
          this.handleSnippetUpdate(message.snippet);
          break;
        case 'error':
          this.log('error', message.error.message, message.error.details);
          break;
      }
    });

    // Handle worker errors
    this.worker.on('error', (error) => {
      this.log('error', 'Worker error', error.toString());
      this.isConnected = false;
      this.notifyStatusChange();
    });

    // Initialize the worker
    this.worker.postMessage({
      type: 'initialize',
      config: {
        serverUrl: this.serverUrl
      }
    });
  }

  handleStatusUpdate(status) {
    const statusChanged = this.isConnected !== status.connected;
    this.isConnected = status.connected;
    this.pendingChanges = new Array(status.pendingChanges);
    
    if (statusChanged) {
      this.notifyStatusChange();
    }
  }

  handleSnippetUpdate(snippet) {
    // Update snippet in local database
    const localSnippet = snippetService.getSnippetById(snippet.id);
    
    if (!localSnippet || localSnippet.version < snippet.version) {
      snippetService.updateSnippet(
        snippet.id,
        snippet.title,
        snippet.content,
        snippet.tags || [],
        localSnippet ? localSnippet.favorite : false
      );
      
      this.log('success', `Updated snippet #${snippet.id} from server`, `Version ${snippet.version}`);
    }
  }

  // Push a snippet to the server
  pushSnippet(snippet) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'pushSnippet',
        snippet
      });
    }
  }

  // Pull a snippet from the server
  pullSnippet(snippetId) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'pullSnippet',
        snippetId
      });
    }
  }

  // Check connection status
  isConnectedToServer() {
    return this.isConnected;
  }
  
  // Get server URL
  getServerUrl() {
    if (this.serverUrl) {
      return this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/sync', '');
    }
    return null;
  }

  // Notify renderer about status changes
  notifyStatusChange() {
    const windows = BrowserWindow.getAllWindows();
    const status = {
      connected: this.isConnected,
      pendingChanges: this.pendingChanges.length
    };

    windows.forEach(window => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send('sync:connection-status', status);
      }
    });
  }

  // Disconnect and clean up
  disconnect() {
    if (this.worker) {
      this.worker.postMessage({ type: 'disconnect' });
      this.worker.terminate();
      this.worker = null;
    }
    this.isConnected = false;
    this.notifyStatusChange();
    this.log('info', 'Disconnected from sync server');
  }

  // Log an event
  log(type, message, details = '') {
    const logEntry = {
      id: uuid.v4(),
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };

    this.logEntries.push(logEntry);
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }

    db.set('syncLog', this.logEntries);
    this.sendLogEntryToRenderer(logEntry);
  }

  // Send log entry to renderer
  sendLogEntryToRenderer(logEntry) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('sync:log-entry', logEntry);
      }
    });
  }

  // Get log entries
  getLogEntries() {
    return this.logEntries.slice(-100);
  }
}

// Create a singleton instance
const syncService = new SyncService();

module.exports = syncService; 