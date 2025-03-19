const WebSocket = require('ws');
const uuid = require('uuid');
const snippetService = require('./snippetService');
const db = require('./db');

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
  }

  // Initialize the sync service
  initialize() {
    // Load or generate client ID
    this.clientId = db.get('clientId');
    if (!this.clientId) {
      this.clientId = uuid.v4();
      db.set('clientId', this.clientId);
    }

    // Connect to the server
    this.connect();

    // Register message handlers
    this.registerMessageHandlers();
  }

  // Connect to the sync server
  connect() {
    if (this.ws) {
      this.ws.terminate();
    }

    try {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.on('open', () => {
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
          this.handleMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from sync server');
        this.isConnected = false;
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
      });
    } catch (error) {
      console.error('Failed to connect to sync server:', error);
      this.attemptReconnect();
    }
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
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
        
        console.log(`Updated snippet #${snippet_id} from server (version ${version})`);
      }
    };
    
    // Handle confirmation of pushed changes
    this.messageHandlers['confirm'] = (message) => {
      const { snippet_id, version } = message;
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
      console.warn('Unhandled message type:', message.type);
    }
  }

  // Push a snippet to the server
  pushSnippet(snippet) {
    if (!this.isConnected) {
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
      console.log(`Pushed snippet #${snippet.id} to server`);
    } catch (error) {
      console.error('Failed to push snippet:', error);
      this.queueChange(snippet);
    }
  }

  // Pull a snippet from the server
  pullSnippet(snippetId) {
    if (!this.isConnected) {
      console.warn('Not connected, cannot pull snippet');
      return;
    }

    try {
      const message = {
        type: 'pull',
        snippet_id: snippetId
      };

      this.ws.send(JSON.stringify(message));
      console.log(`Requested snippet #${snippetId} from server`);
    } catch (error) {
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
    } else {
      this.pendingChanges.push(change);
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
    
    console.log(`Syncing ${this.pendingChanges.length} pending changes`);
    this.syncInProgress = true;
    
    // Process one change at a time
    const change = this.pendingChanges[0];
    
    try {
      this.ws.send(JSON.stringify(change));
      console.log(`Synced pending change for snippet #${change.snippet_id}`);
      
      // Remove from the queue (will be completely removed when confirm is received)
      this.pendingChanges.shift();
      db.set('pendingChanges', this.pendingChanges);
      
    } catch (error) {
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

  // Force disconnect (for testing or cleanup)
  disconnect() {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Create a singleton instance
const syncService = new SyncService();

module.exports = syncService; 