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
	logger    *log.Logger
}

// NewSyncManager creates a new instance of SyncManager
func NewSyncManager(db *DBManager, logger *log.Logger) *SyncManager {
	return &SyncManager{
		clients: make(map[string]*websocket.Conn),
		db:      db,
		logger:  logger,
	}
}

// HandleClient manages a client connection
func (sm *SyncManager) HandleClient(clientID string, conn *websocket.Conn) {
	// Add client to the map
	sm.clientsMu.Lock()
	sm.clients[clientID] = conn
	sm.clientsMu.Unlock()

	sm.logger.Printf("[CLIENT] New connection: %s (total: %d)", clientID, len(sm.clients))

	// Clean up on disconnect
	defer func() {
		sm.clientsMu.Lock()
		delete(sm.clients, clientID)
		sm.clientsMu.Unlock()
		conn.Close()
		sm.logger.Printf("[CLIENT] Disconnected: %s (remaining: %d)", clientID, len(sm.clients))
	}()

	// Handle messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			sm.logger.Printf("[ERROR] Error reading message from %s: %v", clientID, err)
			break
		}

		var msg SyncMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			sm.logger.Printf("[ERROR] Error unmarshaling message from %s: %v", clientID, err)
			continue
		}

		sm.logger.Printf("[RECV] Message from %s: type=%s, snippet=%d", 
			clientID, msg.Type, msg.SnippetID)

		if err := validateSyncMessage(msg); err != nil {
			sm.logger.Printf("[ERROR] Invalid message from %s: %v", clientID, err)
			continue
		}

		if err := sm.handleMessage(clientID, msg); err != nil {
			sm.logger.Printf("[ERROR] Error handling message from %s: %v", clientID, err)
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
			sm.logger.Printf("[ERROR] Failed to save snippet #%d from %s: %v", 
				msg.SnippetID, clientID, err)
			return err
		}
		
		sm.logger.Printf("[DB] Saved snippet #%d from %s (version %d)", 
			msg.SnippetID, clientID, msg.Version)
		
		// Send confirmation to the source client
		response := SyncMessage{
			Type:      "confirm",
			SnippetID: msg.SnippetID,
			Version:   msg.Version,
		}
		conn := sm.clients[clientID]
		if err := conn.WriteJSON(response); err != nil {
			sm.logger.Printf("[ERROR] Failed to send confirmation to %s: %v", 
				clientID, err)
			return err
		}
		
		sm.logger.Printf("[SEND] Confirmation to %s for snippet #%d", 
			clientID, msg.SnippetID)
		
		// Notify other clients
		sm.notifyOtherClients(clientID, msg)

	case "pull":
		snippet, err := sm.db.GetSnippet(int(msg.SnippetID))
		if err != nil {
			sm.logger.Printf("[ERROR] Failed to get snippet #%d for %s: %v", 
				msg.SnippetID, clientID, err)
			return err
		}
		
		sm.logger.Printf("[DB] Retrieved snippet #%d (version %d) for %s", 
			snippet.ID, snippet.Version, clientID)
		
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
		
		sm.logger.Printf("[SEND] Update to %s for snippet #%d", 
			clientID, snippet.ID)
		
		return conn.WriteJSON(response)
	}
	return nil
}

// notifyOtherClients sends updates to all connected clients except the source
func (sm *SyncManager) notifyOtherClients(sourceID string, msg SyncMessage) {
	sm.clientsMu.RLock()
	defer sm.clientsMu.RUnlock()

	notificationCount := 0
	
	for clientID, conn := range sm.clients {
		if clientID != sourceID {
			if err := conn.WriteJSON(msg); err != nil {
				sm.logger.Printf("[ERROR] Error notifying client %s: %v", clientID, err)
			} else {
				notificationCount++
			}
		}
	}
	
	if notificationCount > 0 {
		sm.logger.Printf("[BROADCAST] Notified %d clients about snippet #%d update", 
			notificationCount, msg.SnippetID)
	}
}