# CodexPad Backup System

This document details the backup system implemented in CodexPad to ensure data safety and recovery options.

## Overview

CodexPad implements a comprehensive backup system for both the local application data and the synchronization server database. The backup system provides protection against data loss, corruption, and allows recovery to previous states.

## Local Backups

### Electron Store Persistence

The primary local storage mechanism uses Electron Store, which automatically persists data to the filesystem in JSON format. This provides inherent resilience against application crashes, as data is written to disk immediately after each operation.

### Local Backup Location

Local backups are stored in platform-specific locations:

- **Windows**: `%APPDATA%\CodexPad\backups\`
- **macOS**: `~/Library/Application Support/CodexPad/backups/`
- **Linux**: `~/.config/CodexPad/backups/`

### Backup Frequency

Local backups are created:

1. Automatically every 24 hours while the application is running
2. On application exit after changes have been made
3. Manually when triggered by the user through the UI

## Server Backups

### SQLite Database Backups

The Go synchronization server implements a more comprehensive backup system for the SQLite database.

### Backup Configuration

Server backups use the following configuration by default:

```go
BackupConfig{
    BackupDir:     "~/.codexpad/backups/",
    Interval:      6 * time.Hour,  // Backup every 6 hours
    MaxBackups:    30,             // Keep last 30 backups
    RetentionDays: 30,            // Keep backups for 30 days
}
```

### Backup Naming Convention

Server backups follow a timestamp-based naming convention:

```
codexpad_YYYY-MM-DD_HH-MM-SS.db
```

For example: `codexpad_2023-05-15_14-30-00.db`

### Backup Process

The server backup process follows these steps:

1. Create a point-in-time copy of the SQLite database
2. Write the copy to a new file in the backups directory
3. Update the backup log with metadata about the backup
4. Apply the retention policy to remove old backups

### Automatic Backup Scheduling

The `BackupService` component of the server handles automatic backup scheduling:

1. A ticker is created at the configured interval (default: 6 hours)
2. When the ticker fires, a backup is created
3. The backup process runs in a separate goroutine to avoid blocking operations
4. A log entry is created for each backup attempt

### Manual Backup Trigger

Users can trigger manual backups through:

1. The application UI via a "Create Backup" button in settings
2. A direct HTTP request to the server's `/backup` endpoint

Example HTTP request:

```
POST http://localhost:8080/backup
```

Response:

```json
{
  "status": "success",
  "message": "Backup created successfully"
}
```

## Backup Retention

### Retention Policies

The backup system implements two complementary retention policies:

1. **Count-based retention**: Keeps the N most recent backups (default: 30)
2. **Time-based retention**: Keeps backups for up to N days (default: 30 days)

When either limit is reached, older backups are automatically removed.

### Cleanup Process

The cleanup process runs after each backup creation:

1. Get a list of all backup files in the backup directory
2. Sort them by creation time (newest first)
3. Apply the count-based retention: remove all backups beyond `MaxBackups`
4. Apply the time-based retention: remove all backups older than `RetentionDays`

## Backup Recovery

### Manual Recovery Process

To recover from a backup:

1. Stop the CodexPad application and/or sync server
2. Locate the desired backup file in the backup directory
3. Replace the current database file with the backup
4. Restart the application/server

### Future Enhancement: In-App Recovery

A planned enhancement is to add in-app recovery functionality:

1. List available backups with timestamps
2. Select a backup to preview its contents
3. Restore all data or selectively restore specific snippets
4. Maintain a log of restore operations

## Backup Monitoring

### Backup Logs

The backup system maintains detailed logs of all backup operations:

1. Successful backups with timestamp and size
2. Failed backups with error details
3. Cleanup operations with details of removed backups

### Log Access

Backup logs can be accessed through:

1. The server's log file (`sync_server.log`)
2. The application UI via the sync status panel (for recent entries)

## Implementation Details

### Server Implementation (Go)

Key components of the server backup system:

```go
// BackupConfig defines backup parameters
type BackupConfig struct {
    BackupDir     string        // Directory to store backups
    Interval      time.Duration // Backup interval
    MaxBackups    int           // Maximum number of backups to keep
    RetentionDays int           // Number of days to keep backups
}

// BackupService manages the backup process
type BackupService struct {
    config  BackupConfig
    dbPath  string
    logger  *log.Logger
    stopCh  chan struct{}
}

// Key methods:
// - Start(): Begins the backup scheduler
// - CreateBackup(): Creates a new backup
// - cleanupOldBackups(): Removes old backups based on retention policy
```

### Client Implementation

The client application interacts with the backup system through:

```typescript
// Backup functions in Electron main process
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

    // Handle response...
  } catch (error) {
    // Handle errors...
  }
});
``` 