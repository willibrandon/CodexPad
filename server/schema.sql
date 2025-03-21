-- CodexPad Database Schema
-- This schema defines the database structure for storing and managing code snippets,
-- including support for tagging, versioning, and real-time synchronization.

-- Snippets table stores the actual content and metadata of each code snippet
CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY,                                    -- Unique identifier for each snippet
    title TEXT NOT NULL,                                      -- Display name/title of the snippet
    content TEXT,                                             -- The actual code/note content
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- When the snippet was first created
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- When the snippet was last modified
    version INTEGER NOT NULL DEFAULT 1,                        -- Version number for concurrency control
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE                  -- Soft delete flag
);

-- Tags table for snippet categorization
-- Stores unique tags that can be associated with multiple snippets
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,        -- Unique identifier for each tag
    name TEXT NOT NULL UNIQUE      -- Tag name (unique to prevent duplicates)
);

-- Junction table for many-to-many relationship between snippets and tags
-- Allows each snippet to have multiple tags and each tag to be used by multiple snippets
CREATE TABLE IF NOT EXISTS snippet_tags (
    snippet_id INTEGER NOT NULL,   -- References snippets.id
    tag_id INTEGER NOT NULL,       -- References tags.id
    PRIMARY KEY (snippet_id, tag_id),
    FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,  -- Automatically remove associations when snippet is deleted
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE          -- Automatically remove associations when tag is deleted
);

-- Sync state table tracks the last known state for each client
-- Used for managing real-time synchronization between multiple clients
CREATE TABLE IF NOT EXISTS sync_states (
    client_id TEXT PRIMARY KEY,                                   -- Unique identifier for each client
    last_sync_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,    -- When the client last synced
    last_version INTEGER NOT NULL DEFAULT 0                       -- Last version number seen by this client
);

-- Change log tracks all modifications for conflict resolution
-- Maintains a complete history of changes for synchronization and conflict resolution
CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY,                    -- Unique identifier for each change
    snippet_id INTEGER NOT NULL,               -- The snippet that was modified
    version INTEGER NOT NULL,                  -- Version number after this change
    operation TEXT NOT NULL CHECK (            -- Type of change made
        operation IN ('create', 'update', 'delete')
    ),
    changes JSON NOT NULL,                     -- Detailed change data in JSON format
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- When the change occurred
    client_id TEXT NOT NULL,                   -- Which client made the change
    FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE  -- Clean up change log when snippet is deleted
);

-- Performance Optimization: Indexes
-- These indexes improve query performance for common operations

-- Index for finding recently modified snippets
CREATE INDEX IF NOT EXISTS idx_snippets_updated ON snippets(updated_at);

-- Index for version lookups during sync
CREATE INDEX IF NOT EXISTS idx_snippets_version ON snippets(version);

-- Compound index for efficient change log queries during sync
CREATE INDEX IF NOT EXISTS idx_change_log_snippet ON change_log(snippet_id, version);

-- Index for finding changes by client
CREATE INDEX IF NOT EXISTS idx_change_log_client ON change_log(client_id, timestamp);

-- View: pending_changes
-- This view simplifies conflict detection by showing changes that haven't been
-- synced to each client. It joins the change_log with sync_states to find
-- changes that occurred after a client's last sync.
CREATE VIEW IF NOT EXISTS pending_changes AS
SELECT 
    c.snippet_id,
    c.version,
    c.operation,
    c.changes,
    c.timestamp,
    c.client_id,
    s.last_version as client_version
FROM change_log c
JOIN sync_states s ON c.client_id != s.client_id  -- Only show changes from other clients
WHERE c.version > s.last_version;                 -- Only show changes newer than client's last sync 