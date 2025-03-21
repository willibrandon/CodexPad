// Package main implements the CodexPad sync server, which provides
// real-time synchronization of code snippets between clients using WebSocket
// connections. It also includes automated backup functionality and health monitoring.
package main

import (
	"fmt"
	"io"
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
	// upgrader configures the WebSocket connection parameters.
	// In development mode, it allows connections from any origin.
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins in development
		},
	}

	// syncManager handles synchronization between connected clients
	syncManager *SyncManager

	// syncLogger provides logging for sync-related operations
	syncLogger *log.Logger
)

// handleSync handles incoming WebSocket connections for snippet synchronization.
// For each new connection, it:
// 1. Upgrades the HTTP connection to WebSocket
// 2. Generates a unique client ID
// 3. Registers the client with the sync manager
// Any connection errors are logged but do not affect other clients.
func handleSync(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		syncLogger.Printf("[ERROR] Failed to upgrade connection: %v", err)
		return
	}

	// Generate client ID
	clientID := uuid.New().String()
	syncLogger.Printf("[INFO] New sync connection established (ID: %s)", clientID)

	// Handle client in sync manager
	syncManager.HandleClient(clientID, conn)
}

// main initializes and starts the CodexPad sync server.
// It sets up:
// - Logging to both console and file
// - Database connection
// - Backup service with configurable retention
// - Sync manager for real-time updates
// - HTTP endpoints for health checks and manual backups
func main() {
	// Create and configure server logger
	logFile, err := os.OpenFile("sync_server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}
	defer logFile.Close()

	// Create a multi-writer that writes to both console and file
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	syncLogger = log.New(multiWriter, "", log.LstdFlags)
	syncLogger.SetPrefix("[SYNC] ")

	syncLogger.Println("Starting CodexPad sync server...")

	// Initialize database
	dbPath := getDBPath()
	syncLogger.Printf("Using database at: %s", dbPath)
	db, err := NewDBManager(dbPath)
	if err != nil {
		syncLogger.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize backup service
	backupConfig := BackupConfig{
		BackupDir:     filepath.Join(filepath.Dir(dbPath), "backups"),
		Interval:      6 * time.Hour, // Backup every 6 hours
		MaxBackups:    30,            // Keep last 30 backups
		RetentionDays: 30,            // Keep backups for 30 days
	}

	// Create a backup-specific logger
	backupLogger := log.New(multiWriter, "[BACKUP] ", log.LstdFlags)

	backupService := NewBackupService(backupConfig, dbPath, backupLogger)
	if err := backupService.Start(); err != nil {
		syncLogger.Printf("Warning: Failed to start backup service: %v", err)
	} else {
		syncLogger.Printf("Backup service started. Backup directory: %s", backupConfig.BackupDir)
		defer backupService.Stop()
	}

	// Initialize sync manager
	syncManager = NewSyncManager(db, syncLogger)
	syncLogger.Println("SyncManager initialized")

	// Set up router
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "CodexPad sync server is running",
		})
	})

	// Backup endpoint - manually trigger a backup
	router.POST("/backup", func(c *gin.Context) {
		syncLogger.Println("Manual backup requested")

		if err := backupService.CreateBackup(); err != nil {
			syncLogger.Printf("Manual backup failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Backup failed: %v", err),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Backup created successfully",
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
	syncLogger.Printf("Starting server on port %s", port)
	if err := router.Run(":" + port); err != nil {
		syncLogger.Fatalf("Failed to start server: %v", err)
	}
}

// getDBPath returns the path to the SQLite database file.
// It creates the necessary directory structure if it doesn't exist.
// The database is stored in the user's home directory under .codexpad/.
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
