const WebSocket = require('ws');
const uuid = require('uuid');
const snippetService = require('./snippetService');
const db = require('./db');
const { BrowserWindow } = require('electron');

class SyncService {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.serverUrl = process.env.SYNC_SERVER_URL || 'ws://localhost:8080/sync';
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // Start with 2 seconds
    this.syncInProgress = false;
    this.pendingChanges = [];
    this.messageHandlers = {};
    this.logEntries = [];
    this.maxLogEntries = 1000; // Limit log entries to prevent memory bloat
    this.reconnectTimeout = null;
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

    // Connect to the server
    this.connect();

    // Register message handlers
    this.registerMessageHandlers();
    
    // Load any stored log entries
    const storedLogs = db.get('syncLog') || [];
    this.logEntries = storedLogs.slice(-this.maxLogEntries); // Only keep last N entries
  }

  // Clean up WebSocket connection
  cleanup() {
    if (this.ws) {
      // Remove all listeners before closing
      this.ws.removeAllListeners('open');
      this.ws.removeAllListeners('message');
      this.ws.removeAllListeners('close');
      this.ws.removeAllListeners('error');
      
      // Close the connection
      this.ws.terminate();
      this.ws = null;
    }

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnected = false;
  }

  // Connect to the sync server
  connect() {
    // Clean up any existing connection first
    this.cleanup();

    try {
      this.log('info', 'Connecting to sync server', `Server URL: ${this.serverUrl}`);
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.on('open', () => {
        this.log('success', 'Connected to sync server');
        console.log('Connected to sync server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000;
        
        // Sync pending changes after connection is established
        this.syncPendingChanges();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.log('info', `Received ${message.type} message`, JSON.stringify(message, null, 2));
          this.handleMessage(message);
        } catch (err) {
          this.log('error', 'Failed to parse message', err.toString());
          console.error('Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        this.log('warning', 'Disconnected from sync server');
        console.log('Disconnected from sync server');
        this.isConnected = false;
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        this.log('error', 'WebSocket error', error.toString());
        console.error('WebSocket error:', error);
        this.isConnected = false;
      });
    } catch (error) {
      this.log('error', 'Failed to connect to sync server', error.toString());
      console.error('Failed to connect to sync server:', error);
      this.attemptReconnect();
    }
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('warning', 'Max reconnect attempts reached');
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    this.log('info', `Attempting to reconnect in ${Math.round(delay / 1000)}s`, `Attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}`);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Set new timeout
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  // Register message handlers
  registerMessageHandlers() {
    // Handle sync response (server sends updated snippet)
    this.messageHandlers['update'] = (message) => {
      const { snippet_id, title, content, tags, version, updated_at } = message;
      
      // Convert the server snippet format to our local format
      const updatedSnippet = {
        id: snippet_id,
        title,
        content,
        tags: tags || [],
        updatedAt: updated_at,
        version
      };
      
      // Update snippet in local database
      const localSnippet = snippetService.getSnippetById(snippet_id);
      
      if (!localSnippet || localSnippet.version < version) {
        snippetService.updateSnippet(
          snippet_id,
          title,
          content,
          tags || [],
          localSnippet ? localSnippet.favorite : false
        );
        
        this.log('success', `Updated snippet #${snippet_id} from server`, `Version ${version}`);
        console.log(`Updated snippet #${snippet_id} from server (version ${version})`);
      }
    };
    
    // Handle confirmation of pushed changes
    this.messageHandlers['confirm'] = (message) => {
      const { snippet_id, version } = message;
      this.log('success', `Server confirmed snippet #${snippet_id}`, `Version ${version}`);
      console.log(`Server confirmed snippet #${snippet_id} (version ${version})`);
      
      // Remove from pending changes if it was queued
      this.pendingChanges = this.pendingChanges.filter(
        change => !(change.snippet_id === snippet_id && change.version === version)
      );
    };
  }

  // Handle incoming messages from the server
  handleMessage(message) {
    const handler = this.messageHandlers[message.type];
    
    if (handler) {
      handler(message);
    } else {
      this.log('warning', `Unhandled message type: ${message.type}`);
      console.warn('Unhandled message type:', message.type);
    }
  }

  // Push a snippet to the server
  pushSnippet(snippet) {
    if (!this.isConnected) {
      this.log('warning', 'Not connected, queueing change for later', `Snippet #${snippet.id}`);
      console.log('Not connected, queueing change for later');
      this.queueChange(snippet);
      return;
    }

    try {
      const message = {
        type: 'push',
        snippet_id: snippet.id,
        title: snippet.title,
        content: snippet.content,
        tags: snippet.tags || [],
        version: snippet.version || 1,
        updated_at: snippet.updatedAt
      };

      this.ws.send(JSON.stringify(message));
      this.log('info', `Pushed snippet #${snippet.id} to server`, `Title: ${snippet.title}`);
      console.log(`Pushed snippet #${snippet.id} to server`);
    } catch (error) {
      this.log('error', `Failed to push snippet #${snippet.id}`, error.toString());
      console.error('Failed to push snippet:', error);
      this.queueChange(snippet);
    }
  }

  // Pull a snippet from the server
  pullSnippet(snippetId) {
    if (!this.isConnected) {
      this.log('warning', 'Not connected, cannot pull snippet', `Snippet #${snippetId}`);
      console.warn('Not connected, cannot pull snippet');
      return;
    }

    try {
      const message = {
        type: 'pull',
        snippet_id: snippetId
      };

      this.ws.send(JSON.stringify(message));
      this.log('info', `Requested snippet #${snippetId} from server`);
      console.log(`Requested snippet #${snippetId} from server`);
    } catch (error) {
      this.log('error', `Failed to pull snippet #${snippetId}`, error.toString());
      console.error('Failed to pull snippet:', error);
    }
  }

  // Queue a change for later synchronization
  queueChange(snippet) {
    const change = {
      type: 'push',
      snippet_id: snippet.id,
      title: snippet.title,
      content: snippet.content,
      tags: snippet.tags || [],
      version: snippet.version || 1,
      updated_at: snippet.updatedAt
    };

    // Prevent duplicates in the queue
    const existingIndex = this.pendingChanges.findIndex(c => c.snippet_id === change.snippet_id);
    
    if (existingIndex >= 0) {
      this.pendingChanges[existingIndex] = change;
      this.log('info', `Updated queued change for snippet #${snippet.id}`);
    } else {
      this.pendingChanges.push(change);
      this.log('info', `Queued change for snippet #${snippet.id} for later sync`);
    }
    
    // Store pending changes in the database for persistence
    db.set('pendingChanges', this.pendingChanges);
  }

  // Sync pending changes
  syncPendingChanges() {
    if (!this.isConnected || this.syncInProgress) {
      return;
    }
    
    // Load pending changes from database
    const storedChanges = db.get('pendingChanges') || [];
    
    // Merge with in-memory changes, prioritizing newer ones
    this.pendingChanges = [
      ...storedChanges.filter(sc => 
        !this.pendingChanges.some(pc => pc.snippet_id === sc.snippet_id)
      ),
      ...this.pendingChanges
    ];
    
    if (this.pendingChanges.length === 0) {
      return;
    }
    
    this.log('info', `Syncing ${this.pendingChanges.length} pending changes`);
    console.log(`Syncing ${this.pendingChanges.length} pending changes`);
    this.syncInProgress = true;
    
    // Process one change at a time
    const change = this.pendingChanges[0];
    
    try {
      this.ws.send(JSON.stringify(change));
      this.log('success', `Synced pending change for snippet #${change.snippet_id}`);
      console.log(`Synced pending change for snippet #${change.snippet_id}`);
      
      // Remove from the queue (will be completely removed when confirm is received)
      this.pendingChanges.shift();
      db.set('pendingChanges', this.pendingChanges);
      
    } catch (error) {
      this.log('error', `Failed to sync pending change for snippet #${change.snippet_id}`, error.toString());
      console.error('Failed to sync pending change:', error);
    }
    
    this.syncInProgress = false;
    
    // Continue with next change if there are more
    if (this.pendingChanges.length > 0) {
      setTimeout(() => {
        this.syncPendingChanges();
      }, 100);
    }
  }

  // Check connection status
  isConnectedToServer() {
    return this.isConnected;
  }
  
  // Get server URL (extract HTTP URL from WebSocket URL)
  getServerUrl() {
    // Convert WebSocket URL to HTTP URL
    if (this.serverUrl) {
      return this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/sync', '');
    }
    return null;
  }

  // Disconnect and clean up
  disconnect() {
    this.cleanup();
    this.log('info', 'Disconnected from sync server');
  }

  // Log an event and manage log entry limits
  log(type, message, details = '') {
    const logEntry = {
      id: uuid.v4(),
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };

    // Add to in-memory log, maintaining size limit
    this.logEntries.push(logEntry);
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }

    // Store in database, also maintaining size limit
    db.set('syncLog', this.logEntries);

    // Send to renderer if available
    this.sendLogEntryToRenderer(logEntry);
  }

  // Send log entry to renderer
  sendLogEntryToRenderer(logEntry) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('sync:log-entry', logEntry);
        }
      });
    }
  }

  // Get log entries with limit
  getLogEntries() {
    return this.logEntries.slice(-100); // Return only last 100 entries for display
  }
}

// Create a singleton instance
const syncService = new SyncService();

module.exports = syncService; 