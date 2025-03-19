package main

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// SyncManager manages client connections and synchronization
type SyncManager struct {
	clients   map[string]*websocket.Conn
	clientsMu sync.RWMutex
	db        *DBManager
}

// NewSyncManager creates a new instance of SyncManager
func NewSyncManager(db *DBManager) *SyncManager {
	return &SyncManager{
		clients: make(map[string]*websocket.Conn),
		db:      db,
	}
}

// HandleClient manages a client connection
func (sm *SyncManager) HandleClient(clientID string, conn *websocket.Conn) {
	// Add client to the map
	sm.clientsMu.Lock()
	sm.clients[clientID] = conn
	sm.clientsMu.Unlock()

	// Clean up on disconnect
	defer func() {
		sm.clientsMu.Lock()
		delete(sm.clients, clientID)
		sm.clientsMu.Unlock()
		conn.Close()
	}()

	// Handle messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		var msg SyncMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		if err := validateSyncMessage(msg); err != nil {
			log.Printf("Invalid message: %v", err)
			continue
		}

		if err := sm.handleMessage(clientID, msg); err != nil {
			log.Printf("Error handling message: %v", err)
		}
	}
}

// handleMessage processes incoming sync messages
func (sm *SyncManager) handleMessage(clientID string, msg SyncMessage) error {
	switch msg.Type {
	case "push":
		snippet := &Snippet{
			ID:        int(msg.SnippetID),
			Title:     msg.Title,
			Content:   msg.Content,
			Tags:      msg.Tags,
			Version:   int(msg.Version),
			UpdatedAt: msg.UpdatedAt,
		}
		if err := sm.db.SaveSnippet(snippet, clientID); err != nil {
			return err
		}
		
		// Send confirmation to the source client
		response := SyncMessage{
			Type:      "confirm",
			SnippetID: msg.SnippetID,
			Version:   msg.Version,
		}
		conn := sm.clients[clientID]
		if err := conn.WriteJSON(response); err != nil {
			return err
		}
		
		// Notify other clients
		sm.notifyOtherClients(clientID, msg)

	case "pull":
		snippet, err := sm.db.GetSnippet(int(msg.SnippetID))
		if err != nil {
			return err
		}
		response := SyncMessage{
			Type:      "update",
			SnippetID: snippet.ID,
			Content:   snippet.Content,
			Title:     snippet.Title,
			Tags:      snippet.Tags,
			Version:   snippet.Version,
			UpdatedAt: snippet.UpdatedAt,
		}
		conn := sm.clients[clientID]
		return conn.WriteJSON(response)
	}
	return nil
}

// notifyOtherClients sends updates to all connected clients except the source
func (sm *SyncManager) notifyOtherClients(sourceID string, msg SyncMessage) {
	sm.clientsMu.RLock()
	defer sm.clientsMu.RUnlock()

	for clientID, conn := range sm.clients {
		if clientID != sourceID {
			if err := conn.WriteJSON(msg); err != nil {
				log.Printf("Error notifying client %s: %v", clientID, err)
			}
		}
	}
}