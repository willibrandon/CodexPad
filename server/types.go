package main

import (
	"fmt"
	"time"
)

// SyncMessage represents a message in the sync protocol
type SyncMessage struct {
	Type      string    `json:"type"`                // push, pull, sync, update, confirm, error
	SnippetID int       `json:"snippet_id"`         // ID of the snippet
	Title     string    `json:"title,omitempty"`    // Title of the snippet
	Content   string    `json:"content,omitempty"`  // Content of the snippet
	Version   int       `json:"version,omitempty"`  // Version number
	UpdatedAt time.Time `json:"updated_at,omitempty"` // Last update timestamp
	Tags      []string  `json:"tags,omitempty"`     // Tags associated with the snippet
}

// ServerStats represents server statistics
type ServerStats struct {
	Uptime       string    `json:"uptime"`
	NumGoroutine int       `json:"num_goroutines"`
	NumCPU       int       `json:"num_cpu"`
	StartTime    time.Time `json:"start_time"`
}

// validateSyncMessage validates a sync message
func validateSyncMessage(msg SyncMessage) error {
	if msg.SnippetID <= 0 {
		return fmt.Errorf("invalid snippet ID: %d", msg.SnippetID)
	}

	switch msg.Type {
	case "push":
		if msg.Title == "" {
			return fmt.Errorf("title is required")
		}
		if msg.Version <= 0 {
			return fmt.Errorf("invalid version number: %d", msg.Version)
		}
	case "pull", "sync":
		// No additional validation needed
	default:
		return fmt.Errorf("invalid message type: %s", msg.Type)
	}

	return nil
} 