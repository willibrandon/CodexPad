# CodexPad Synchronization Protocol

This document details the synchronization protocol used by CodexPad to keep snippets synchronized across multiple devices.

## Overview

CodexPad uses a WebSocket-based synchronization protocol with a central server written in Go. The protocol enables real-time bidirectional communication between clients and the server, allowing changes to propagate immediately across all connected devices.

## Components

The synchronization system consists of:

1. **Client-side Sync Service** - Implemented in JavaScript/TypeScript within the Electron app
2. **Go-based Sync Server** - Central server handling connections and data persistence
3. **SQLite Database** - Server-side storage for synchronized snippets and change history

## Message Types

The protocol defines several message types for different synchronization operations:

### 1. Push Message

Used to send local changes to the server.

```json
{
  "type": "push",
  "snippet_id": 123,
  "title": "Example Snippet",
  "content": "function example() { return true; }",
  "tags": ["javascript", "example"],
  "version": 2,
  "updated_at": "2023-05-15T14:22:35Z"
}
```

### 2. Pull Message

Used to request the latest version of a specific snippet.

```json
{
  "type": "pull",
  "snippet_id": 123
}
```

### 3. Update Message

Sent by the server to inform clients about changes to a snippet.

```json
{
  "type": "update",
  "snippet_id": 123,
  "title": "Updated Example",
  "content": "function example() { return true; }",
  "tags": ["javascript", "example", "updated"],
  "version": 3,
  "updated_at": "2023-05-15T15:30:42Z"
}
```

### 4. Confirm Message

Sent by the server to acknowledge receipt of a pushed change.

```json
{
  "type": "confirm",
  "snippet_id": 123,
  "version": 2
}
```

### 5. Error Message

Sent by the server when an error occurs during synchronization.

```json
{
  "type": "error",
  "snippet_id": 123,
  "message": "Version conflict detected"
}
```

## Synchronization Flow

### Initial Connection

1. Client establishes a WebSocket connection to `ws://server-address/sync`
2. Server assigns a unique client ID if one is not provided
3. Client receives pending changes since last synchronization

### Snippet Modification

When a snippet is modified on a client:

1. Client saves changes locally
2. Client sends a `push` message to the server
3. Server stores the change in the database
4. Server sends a `confirm` message back to the source client
5. Server broadcasts an `update` message to all other connected clients
6. Other clients apply the changes locally

### Retrieving Latest Version

When a client needs the latest version of a snippet:

1. Client sends a `pull` message for the specific snippet
2. Server retrieves the latest version from the database
3. Server sends an `update` message with the current snippet data
4. Client applies the update locally

## Conflict Resolution

CodexPad implements a versioning system to detect and resolve conflicts:

1. Each snippet has a version number that increments with each modification
2. When a client pushes a change, it includes the current version number
3. The server validates the version against the latest known version
4. If the versions don't match, a conflict is detected

### Conflict Handling Strategy

1. **Last-Write-Wins**: The latest modification is accepted
2. **Change Logging**: All changes are preserved in the change log
3. **Version Tracking**: Version numbers are always incremented
4. **Client Notification**: Clients are notified of conflicts

## Client Identification

Each client has a unique identifier to track synchronization state:

1. **Client ID Generation**: UUID generated on first run
2. **Persistence**: ID stored locally and included in sync messages
3. **Server Tracking**: Server maintains sync state per client ID

## Error Handling

The protocol includes practical error handling:

1. **Connection Errors**: Automatic reconnection with exponential backoff
2. **Message Validation**: Comprehensive validation before processing
3. **Database Errors**: Proper error propagation to clients
4. **Version Conflicts**: Conflict detection and resolution mechanisms

## Security Considerations

The synchronization protocol implements several security measures:

1. **Message Validation**: All messages are validated before processing
2. **Input Sanitization**: All user input is sanitized before storage
3. **Connection Limits**: Rate limiting to prevent abuse
4. **Client Authentication**: (Future enhancement) Token-based authentication

## Implementation Details

### Server Implementation (Go)

The server implementation uses:

- Gorilla WebSocket library for WebSocket connections
- SQLite for data persistence
- Gin web framework for HTTP endpoints

Key server components:

- `SyncManager`: Manages client connections and message routing
- `DBManager`: Handles database operations
- `BackupService`: Manages database backups

### Client Implementation (JavaScript)

The client implementation uses:

- Browser WebSocket API
- Worker threads for non-blocking operations
- Local storage for offline capabilities

Key client components:

- `SyncService`: Manages synchronization with the server
- `snippetService`: Handles local CRUD operations
- `db`: Local storage interface

## Database Schema

The server uses the following schema for synchronization:

```sql
-- Snippets table stores the actual content
CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Change log tracks all modifications for conflict resolution
CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY,
    snippet_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    operation TEXT NOT NULL,
    changes JSON NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_id TEXT NOT NULL
);

-- Sync state table tracks the last known state for each client
CREATE TABLE IF NOT EXISTS sync_states (
    client_id TEXT PRIMARY KEY,
    last_sync_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_version INTEGER NOT NULL DEFAULT 0
);
``` 