// Package main provides type definitions and validation logic for the CodexPad
// sync server. It defines the message formats used in client-server communication
// and server statistics tracking.
package main

import (
	"fmt"
	"time"
)

// SyncMessage represents a message in the sync protocol between clients and server.
// It encapsulates all necessary information for snippet synchronization, including
// content, metadata, and version control information.
type SyncMessage struct {
	Type      string    `json:"type"`                 // Message type: push, pull, sync, update, confirm, error
	SnippetID int       `json:"snippet_id"`           // Unique identifier of the snippet
	Title     string    `json:"title,omitempty"`      // Title of the snippet (optional for some message types)
	Content   string    `json:"content,omitempty"`    // Content of the snippet (optional for some message types)
	Version   int       `json:"version,omitempty"`    // Version number for concurrency control
	UpdatedAt time.Time `json:"updated_at,omitempty"` // Last modification timestamp
	Tags      []string  `json:"tags,omitempty"`       // Associated tags (optional)
}

// ServerStats represents server statistics and health information.
// It provides metrics about server performance and resource utilization
// that can be used for monitoring and diagnostics.
type ServerStats struct {
	Uptime       string    `json:"uptime"`         // Duration since server start
	NumGoroutine int       `json:"num_goroutines"` // Number of active goroutines
	NumCPU       int       `json:"num_cpu"`        // Number of CPU cores available
	StartTime    time.Time `json:"start_time"`     // Server start timestamp
}

// validateSyncMessage validates a sync message to ensure it contains
// all required fields based on its type. It performs the following checks:
// - Validates snippet ID is positive
// - For push messages: ensures title and version are present
// - For pull/sync messages: only validates snippet ID
// - For other message types: returns an error
// Returns an error if validation fails, nil otherwise.
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
