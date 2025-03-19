package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins in development
		},
	}
	syncManager *SyncManager
)

// handleSync handles WebSocket connections
func handleSync(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Generate client ID
	clientID := uuid.New().String()
	log.Printf("New sync connection established")

	// Handle client in sync manager
	syncManager.HandleClient(clientID, conn)
}

func main() {
	// Initialize database
	dbPath := getDBPath()
	db, err := NewDBManager(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize sync manager
	syncManager = NewSyncManager(db)

	// Set up router
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "CodexPad sync server is running",
		})
	})

	// New endpoint to show server stats
	router.GET("/stats", func(c *gin.Context) {
		stats := ServerStats{
			Uptime:       time.Since(time.Now()).String(),
			NumGoroutine: runtime.NumGoroutine(),
			NumCPU:       runtime.NumCPU(),
			StartTime:    time.Now(),
		}
		c.JSON(http.StatusOK, stats)
	})

	// WebSocket endpoint
	router.GET("/sync", handleSync)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting server on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// getDBPath returns the path to the SQLite database file
func getDBPath() string {
	// Get user's home directory
	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Failed to get home directory: %v", err)
	}

	// Create CodexPad directory if it doesn't exist
	dataDir := filepath.Join(home, ".codexpad")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	return filepath.Join(dataDir, "codexpad.db")
} 