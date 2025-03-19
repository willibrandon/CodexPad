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

-- Tags table for snippet categorization
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Junction table for many-to-many relationship between snippets and tags
CREATE TABLE IF NOT EXISTS snippet_tags (
    snippet_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (snippet_id, tag_id),
    FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Sync state table tracks the last known state for each client
CREATE TABLE IF NOT EXISTS sync_states (
    client_id TEXT PRIMARY KEY,
    last_sync_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_version INTEGER NOT NULL DEFAULT 0
);

-- Change log tracks all modifications for conflict resolution
CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY,
    snippet_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    changes JSON NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_id TEXT NOT NULL,
    FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_snippets_updated ON snippets(updated_at);
CREATE INDEX IF NOT EXISTS idx_snippets_version ON snippets(version);
CREATE INDEX IF NOT EXISTS idx_change_log_snippet ON change_log(snippet_id, version);
CREATE INDEX IF NOT EXISTS idx_change_log_client ON change_log(client_id, timestamp);

-- Create a view for easier conflict detection
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
JOIN sync_states s ON c.client_id != s.client_id
WHERE c.version > s.last_version; 