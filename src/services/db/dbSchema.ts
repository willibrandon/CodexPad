import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

// Schema version for future migrations
const SCHEMA_VERSION = 1;

// SQL to create the initial schema
const SCHEMA_SQL = `
-- Create snippets table
CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    favorite INTEGER DEFAULT 0
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Create snippet_tags junction table
CREATE TABLE IF NOT EXISTS snippet_tags (
    snippet_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (snippet_id, tag_id),
    FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Create schema_version table
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_snippets_title ON snippets(title);
CREATE INDEX IF NOT EXISTS idx_snippets_updated ON snippets(updated_at);
CREATE INDEX IF NOT EXISTS idx_snippets_favorite ON snippets(favorite);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
`;

export function initializeDatabase(): Database.Database {
    // Get the user data path from electron
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'snippets.db');

    // Create and initialize the database
    const db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create schema
    db.exec(SCHEMA_SQL);

    // Check/set schema version
    const versionRow = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
    if (!versionRow) {
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    }

    return db;
}

// Prepared statements for common operations
export function prepareStatements(db: Database.Database) {
    return {
        // Snippet operations
        insertSnippet: db.prepare(`
            INSERT INTO snippets (title, content, created_at, updated_at, favorite)
            VALUES (?, ?, ?, ?, ?)
        `),
        
        updateSnippet: db.prepare(`
            UPDATE snippets 
            SET title = ?, content = ?, updated_at = ?, favorite = ?
            WHERE id = ?
        `),
        
        deleteSnippet: db.prepare(`
            DELETE FROM snippets WHERE id = ?
        `),
        
        getSnippet: db.prepare(`
            SELECT s.*, GROUP_CONCAT(t.name) as tags
            FROM snippets s
            LEFT JOIN snippet_tags st ON s.id = st.snippet_id
            LEFT JOIN tags t ON st.tag_id = t.id
            WHERE s.id = ?
            GROUP BY s.id
        `),
        
        getAllSnippets: db.prepare(`
            SELECT s.*, GROUP_CONCAT(t.name) as tags
            FROM snippets s
            LEFT JOIN snippet_tags st ON s.id = st.snippet_id
            LEFT JOIN tags t ON st.tag_id = t.id
            GROUP BY s.id
            ORDER BY s.updated_at DESC
        `),
        
        searchSnippets: db.prepare(`
            SELECT s.*, GROUP_CONCAT(t.name) as tags
            FROM snippets s
            LEFT JOIN snippet_tags st ON s.id = st.snippet_id
            LEFT JOIN tags t ON st.tag_id = t.id
            WHERE s.title LIKE ? OR s.content LIKE ?
            GROUP BY s.id
            ORDER BY s.updated_at DESC
        `),
        
        // Tag operations
        insertTag: db.prepare(`
            INSERT OR IGNORE INTO tags (name) VALUES (?)
            RETURNING id
        `),
        
        getTagByName: db.prepare(`
            SELECT * FROM tags WHERE name = ?
        `),
        
        getAllTags: db.prepare(`
            SELECT * FROM tags ORDER BY name
        `),
        
        // Snippet-Tag operations
        linkSnippetTag: db.prepare(`
            INSERT OR IGNORE INTO snippet_tags (snippet_id, tag_id)
            VALUES (?, ?)
        `),
        
        unlinkSnippetTag: db.prepare(`
            DELETE FROM snippet_tags
            WHERE snippet_id = ? AND tag_id = ?
        `),
        
        clearSnippetTags: db.prepare(`
            DELETE FROM snippet_tags WHERE snippet_id = ?
        `)
    };
}

// Type definitions for our database operations
export interface DBSnippet {
    id: number;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
    favorite: number;
    tags?: string;
}

export interface DBTag {
    id: number;
    name: string;
}

export type PreparedStatements = ReturnType<typeof prepareStatements>; 