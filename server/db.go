package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type DBManager struct {
	db *sql.DB
}

// NewDBManager creates a new database manager
func NewDBManager(dbPath string) (*DBManager, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %v", err)
	}

	// Initialize schema
	if err := initSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %v", err)
	}

	return &DBManager{db: db}, nil
}

// Close closes the database connection
func (m *DBManager) Close() error {
	return m.db.Close()
}

// SaveSnippet saves or updates a snippet
func (m *DBManager) SaveSnippet(snippet *Snippet, clientID string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Check if snippet exists
	var currentVersion int
	err = tx.QueryRow("SELECT version FROM snippets WHERE id = ?", snippet.ID).Scan(&currentVersion)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	var operation string
	if err == sql.ErrNoRows {
		// Create new snippet
		operation = "create"
		_, err = tx.Exec(`
			INSERT INTO snippets (id, title, content, created_at, updated_at, version)
			VALUES (?, ?, ?, ?, ?, 1)
		`, snippet.ID, snippet.Title, snippet.Content, time.Now(), time.Now())
	} else {
		// Update existing snippet
		operation = "update"
		_, err = tx.Exec(`
			UPDATE snippets 
			SET title = ?, content = ?, updated_at = ?, version = version + 1
			WHERE id = ?
		`, snippet.Title, snippet.Content, time.Now(), snippet.ID)
	}
	if err != nil {
		return err
	}

	// Log the change
	changes, err := json.Marshal(snippet)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO change_log (snippet_id, version, operation, changes, client_id)
		VALUES (?, ?, ?, ?, ?)
	`, snippet.ID, currentVersion+1, operation, string(changes), clientID)
	if err != nil {
		return err
	}

	// Update sync state
	_, err = tx.Exec(`
		INSERT INTO sync_states (client_id, last_sync_at, last_version)
		VALUES (?, ?, ?)
		ON CONFLICT(client_id) DO UPDATE SET
			last_sync_at = excluded.last_sync_at,
			last_version = excluded.last_version
	`, clientID, time.Now(), currentVersion+1)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetSnippet retrieves a snippet by ID
func (m *DBManager) GetSnippet(id int) (*Snippet, error) {
	var s Snippet
	err := m.db.QueryRow(`
		SELECT id, title, content, created_at, updated_at, version
		FROM snippets
		WHERE id = ? AND NOT is_deleted
	`, id).Scan(&s.ID, &s.Title, &s.Content, &s.CreatedAt, &s.UpdatedAt, &s.Version)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetPendingChanges gets all changes that need to be synced for a client
func (m *DBManager) GetPendingChanges(clientID string) ([]Change, error) {
	rows, err := m.db.Query(`
		SELECT snippet_id, version, operation, changes
		FROM pending_changes
		WHERE client_id = ?
		ORDER BY version ASC
	`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []Change
	for rows.Next() {
		var c Change
		var changesJSON string
		err := rows.Scan(&c.SnippetID, &c.Version, &c.Operation, &changesJSON)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal([]byte(changesJSON), &c.Changes)
		if err != nil {
			return nil, err
		}

		changes = append(changes, c)
	}

	return changes, nil
}

// initSchema initializes the database schema
func initSchema(db *sql.DB) error {
	// Read schema from file
	schema, err := readFile("schema.sql")
	if err != nil {
		return err
	}

	// Execute schema
	_, err = db.Exec(string(schema))
	return err
}

// Snippet represents a code snippet in the database
type Snippet struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Version   int       `json:"version"`
	Tags      []string  `json:"tags,omitempty"`
}

// Change represents a change in the change log
type Change struct {
	SnippetID int         `json:"snippet_id"`
	Version   int         `json:"version"`
	Operation string      `json:"operation"`
	Changes   interface{} `json:"changes"`
}
