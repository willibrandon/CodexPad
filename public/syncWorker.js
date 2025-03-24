/**
 * @fileoverview Worker thread that handles synchronization with the server
 * Manages WebSocket connections, message queuing, and reconnection logic
 */

const { parentPort } = require('worker_threads');
const WebSocket = require('ws');
const uuid = require('uuid');

let ws = null;
let isConnected = false;
let pendingChanges = [];
let syncInProgress = false;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectDelay = 2000;

// Handle messages from main thread
parentPort.on('message', (message) => {
  switch (message.type) {
    case 'initialize':
      initialize(message.config);
      break;
    case 'pushSnippet':
      pushSnippet(message.snippet);
      break;
    case 'pullSnippet':
      pullSnippet(message.snippetId);
      break;
    case 'disconnect':
      cleanup();
      break;
  }
});

function initialize(config) {
  cleanup(); // Clean up any existing connection
  
  try {
    ws = new WebSocket(config.serverUrl);
    
    ws.on('open', () => {
      isConnected = true;
      reconnectAttempts = 0;
      reconnectDelay = 2000;
      
      // Send initial handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        client_id: uuid.v4()
      }));
      
      parentPort.postMessage({
        type: 'status',
        status: { connected: true, pendingChanges: pendingChanges.length }
      });
      
      // Sync any pending changes
      syncPendingChanges();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleServerMessage(message);
      } catch (err) {
        logError('Failed to parse message', err);
      }
    });

    ws.on('close', () => {
      isConnected = false;
      parentPort.postMessage({
        type: 'status',
        status: { connected: false, pendingChanges: pendingChanges.length }
      });
      attemptReconnect();
    });

    ws.on('error', (error) => {
      isConnected = false;
      logError('WebSocket error', error);
      parentPort.postMessage({
        type: 'status',
        status: { connected: false, pendingChanges: pendingChanges.length }
      });
    });
  } catch (error) {
    logError('Failed to connect', error);
    attemptReconnect();
  }
}

function handleStatusUpdate() {
  parentPort.postMessage({
    type: 'status',
    status: { 
      connected: isConnected, 
      pendingChanges: pendingChanges.length 
    }
  });
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'update':
      parentPort.postMessage({
        type: 'snippetUpdate',
        snippet: {
          id: message.snippet_id,
          title: message.title,
          content: message.content,
          tags: message.tags || [],
          version: message.version,
          updatedAt: message.updated_at
        }
      });
      break;
      
    case 'confirm':
      // Remove from pending changes if confirmed
      pendingChanges = pendingChanges.filter(
        change => !(change.snippet_id === message.snippet_id && change.version === message.version)
      );
      
      handleStatusUpdate();
      break;
  }
}

function pushSnippet(snippet) {
  if (!isConnected) {
    queueChange(snippet);
    return;
  }

  try {
    const snippetId = parseInt(snippet.id, 10);
    const version = parseInt(snippet.version, 10) || 1;
    
    if (isNaN(snippetId)) {
      throw new Error(`Invalid snippet ID: ${snippet.id}`);
    }

    const message = {
      type: 'push',
      snippet_id: snippetId,
      title: snippet.title,
      content: snippet.content,
      tags: snippet.tags || [],
      version: version,
      updated_at: snippet.updatedAt
    };

    ws.send(JSON.stringify(message));
  } catch (error) {
    logError('Failed to push snippet', error);
    queueChange(snippet);
  }
}

function pullSnippet(snippetId) {
  if (!isConnected) {
    logError('Not connected to server', new Error('Cannot pull snippet while disconnected'));
    return;
  }

  try {
    const message = {
      type: 'pull',
      snippet_id: snippetId
    };

    ws.send(JSON.stringify(message));
  } catch (error) {
    logError('Failed to pull snippet', error);
  }
}

function queueChange(snippet) {
  const snippetId = parseInt(snippet.id, 10);
  const version = parseInt(snippet.version, 10) || 1;
  
  if (isNaN(snippetId)) {
    logError('Failed to queue change', new Error(`Invalid snippet ID: ${snippet.id}`));
    return;
  }

  const change = {
    type: 'push',
    snippet_id: snippetId,
    title: snippet.title,
    content: snippet.content,
    tags: snippet.tags || [],
    version: version,
    updated_at: snippet.updatedAt
  };

  // Prevent duplicates in the queue by updating existing entry
  const existingIndex = pendingChanges.findIndex(c => c.snippet_id === change.snippet_id);
  if (existingIndex >= 0) {
    pendingChanges[existingIndex] = change;
  } else {
    pendingChanges.push(change);
  }

  handleStatusUpdate();

  // Trigger sync if connected
  if (isConnected && !syncInProgress) {
    syncPendingChanges();
  }
}

function syncPendingChanges() {
  if (!isConnected || syncInProgress || pendingChanges.length === 0) {
    return;
  }

  syncInProgress = true;
  const change = pendingChanges[0];

  try {
    ws.send(JSON.stringify(change));
    // Note: We don't remove the change here. It will be removed when we get confirmation
  } catch (error) {
    logError('Failed to sync pending change', error);
    syncInProgress = false;
    return;
  }

  syncInProgress = false;

  // Continue with next change if there are more, with a small delay
  if (pendingChanges.length > 0) {
    setTimeout(syncPendingChanges, 100);
  }
}

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    logError('Max reconnect attempts reached', new Error('Failed to reconnect after maximum attempts'));
    return;
  }

  reconnectAttempts++;
  const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);

  // Clear any existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    initialize({ serverUrl: ws.url });
  }, delay);
}

function cleanup() {
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
    ws = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  isConnected = false;
}

function logError(message, error) {
  parentPort.postMessage({
    type: 'error',
    error: {
      message,
      details: error.toString()
    }
  });
} 