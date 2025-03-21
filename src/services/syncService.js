const { Worker } = require('worker_threads');
const path = require('path');
const uuid = require('uuid');
const snippetService = require('./snippetService');
const db = require('./db');
const { BrowserWindow } = require('electron');

/**
 * @typedef {Object} SyncStatus
 * @property {boolean} connected - Whether the service is currently connected to the sync server
 * @property {number} pendingChanges - Number of changes waiting to be synced
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} id - Unique identifier for the log entry
 * @property {string} timestamp - ISO timestamp of when the entry was created
 * @property {'info' | 'success' | 'error' | 'warning'} type - Type of log entry
 * @property {string} message - Main log message
 * @property {string} [details] - Additional details about the log entry
 */

/**
 * Service responsible for synchronizing snippets with a remote server.
 * Uses a WebSocket worker for handling real-time communication and manages
 * the local state of synchronization.
 */
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

  /**
   * Initializes the sync service by setting up the client ID and worker.
   * If no client ID exists, generates a new one and stores it.
   */
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

  /**
   * Sets up the WebSocket worker for handling sync communications.
   * If a worker already exists, it is terminated before creating a new one.
   * @private
   */
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

  /**
   * Handles status updates from the sync worker.
   * @param {SyncStatus} status - Current sync status from the worker
   * @private
   */
  handleStatusUpdate(status) {
    const statusChanged = this.isConnected !== status.connected;
    this.isConnected = status.connected;
    this.pendingChanges = new Array(status.pendingChanges);
    
    if (statusChanged) {
      this.notifyStatusChange();
    }
  }

  /**
   * Handles snippet updates received from the server.
   * Updates the local snippet if the received version is newer.
   * @param {Object} snippet - The snippet data received from the server
   * @private
   */
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

  /**
   * Pushes a snippet to the sync server.
   * @param {Object} snippet - The snippet to push to the server
   */
  pushSnippet(snippet) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'pushSnippet',
        snippet
      });
    }
  }

  /**
   * Pulls a specific snippet from the sync server.
   * @param {number} snippetId - ID of the snippet to pull
   */
  pullSnippet(snippetId) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'pullSnippet',
        snippetId
      });
    }
  }

  /**
   * Checks if the service is currently connected to the sync server.
   * @returns {boolean} True if connected to the server
   */
  isConnectedToServer() {
    return this.isConnected;
  }
  
  /**
   * Gets the HTTP URL of the sync server.
   * @returns {string|null} The server URL or null if not set
   */
  getServerUrl() {
    if (this.serverUrl) {
      return this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/sync', '');
    }
    return null;
  }

  /**
   * Notifies all renderer processes about sync status changes.
   * @private
   */
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

  /**
   * Disconnects from the sync server and cleans up resources.
   */
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

  /**
   * Logs a sync-related event.
   * @param {'info' | 'success' | 'error' | 'warning'} type - Type of log entry
   * @param {string} message - Main log message
   * @param {string} [details=''] - Additional details about the log entry
   */
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

  /**
   * Sends a log entry to all renderer processes.
   * @param {LogEntry} logEntry - The log entry to send
   * @private
   */
  sendLogEntryToRenderer(logEntry) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('sync:log-entry', logEntry);
      }
    });
  }

  /**
   * Gets the most recent log entries.
   * @returns {LogEntry[]} The last 100 log entries
   */
  getLogEntries() {
    return this.logEntries.slice(-100);
  }
}

// Create a singleton instance
const syncService = new SyncService();

module.exports = syncService; 