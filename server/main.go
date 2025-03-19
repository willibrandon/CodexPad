package main

import (
	"fmt"
	"log"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// ServerStats represents our server statistics
// The `json:` tags tell Go how to convert to JSON
type ServerStats struct {
	Uptime       string    `json:"uptime"`
	NumGoroutine int       `json:"num_goroutines"`
	NumCPU       int       `json:"num_cpu"`
	StartTime    time.Time `json:"start_time"`
}

// SyncMessage represents a snippet sync operation
type SyncMessage struct {
	Type      string    `json:"type"`      // "push" or "pull"
	SnippetID int64     `json:"id"`        // Snippet ID
	Content   string    `json:"content"`    // Snippet content
	Title     string    `json:"title"`      // Snippet title
	Tags      []string  `json:"tags"`      // Snippet tags
	Version   int64     `json:"version"`    // For conflict resolution
	UpdatedAt time.Time `json:"updatedAt"` // Last update timestamp
}

// Configure websocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// handleSync handles WebSocket connections for real-time sync
func handleSync(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer ws.Close()

	log.Printf("New sync connection established")

	for {
		// Read message from client
		var message SyncMessage
		err := ws.ReadJSON(&message)
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		// Handle different message types
		switch message.Type {
		case "push":
			// TODO: Store snippet update
			log.Printf("Received push for snippet %d", message.SnippetID)
			// Echo back confirmation
			response := SyncMessage{
				Type:      "confirm",
				SnippetID: message.SnippetID,
				Version:   message.Version,
			}
			if err := ws.WriteJSON(response); err != nil {
				log.Printf("Error sending confirmation: %v", err)
			}

		case "pull":
			// TODO: Retrieve snippet data
			log.Printf("Received pull request for snippet %d", message.SnippetID)
			// Send dummy response for now
			response := SyncMessage{
				Type:      "update",
				SnippetID: message.SnippetID,
				Content:   "Placeholder content",
				Version:   1,
				UpdatedAt: time.Now(),
			}
			if err := ws.WriteJSON(response); err != nil {
				log.Printf("Error sending snippet data: %v", err)
			}
		}
	}
}

// validateSyncMessage checks if a sync message is valid
func validateSyncMessage(msg SyncMessage) error {
	if msg.Type != "push" && msg.Type != "pull" {
		return fmt.Errorf("invalid message type: %s", msg.Type)
	}
	
	if msg.SnippetID <= 0 {
		return fmt.Errorf("invalid snippet ID: %d", msg.SnippetID)
	}

	if msg.Type == "push" {
		if msg.Title == "" {
			return fmt.Errorf("title is required for push messages")
		}
		if msg.Version <= 0 {
			return fmt.Errorf("invalid version number: %d", msg.Version)
		}
	}

	return nil
}

func main() {
	startTime := time.Now()
	// Create a default gin router
	r := gin.Default()

	// Add a simple health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"message": "CodexPad sync server is running",
		})
	})

	// New endpoint to show server stats
	r.GET("/stats", func(c *gin.Context) {
		stats := ServerStats{
			Uptime:       time.Since(startTime).String(),
			NumGoroutine: runtime.NumGoroutine(),
			NumCPU:       runtime.NumCPU(),
			StartTime:    startTime,
		}
		c.JSON(http.StatusOK, stats)
	})

	// Add WebSocket endpoint for sync
	r.GET("/sync", handleSync)

	// Start the server on port 8080
	log.Println("Starting CodexPad sync server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
} 