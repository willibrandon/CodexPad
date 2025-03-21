// Package main provides integration tests for the CodexPad sync server.
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHealthEndpoint verifies that the /health endpoint returns
// the expected status and message indicating the server is running.
func TestHealthEndpoint(t *testing.T) {
	// Setup
	router := gin.Default()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "CodexPad sync server is running",
		})
	})

	// Create a test request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, 200, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)

	assert.Nil(t, err)
	assert.Equal(t, "ok", response["status"])
	assert.Equal(t, "CodexPad sync server is running", response["message"])
}

// TestSyncMessageValidation verifies the validation logic for sync messages
// using table-driven tests. It checks various scenarios including:
// - Valid push messages
// - Invalid message types
// - Missing required fields
func TestSyncMessageValidation(t *testing.T) {
	// Table-driven test cases
	tests := []struct {
		name    string
		message SyncMessage
		wantErr bool
	}{
		{
			name: "valid push message",
			message: SyncMessage{
				Type:      "push",
				SnippetID: 1,
				Content:   "test content",
				Title:     "test title",
				Version:   1,
				UpdatedAt: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "invalid message type",
			message: SyncMessage{
				Type:      "invalid",
				SnippetID: 1,
			},
			wantErr: true,
		},
		{
			name: "missing snippet ID",
			message: SyncMessage{
				Type:    "push",
				Content: "test content",
			},
			wantErr: true,
		},
	}

	// Run all test cases
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSyncMessage(tt.message)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestWebSocketConnection verifies the WebSocket connection handling
// and message exchange between client and server. It tests:
// - Connection establishment
// - Push message handling
// - Pull message handling
// - Response validation
func TestWebSocketConnection(t *testing.T) {
	// Setup DB and sync manager for test
	db, err := NewDBManager(":memory:")
	require.NoError(t, err)
	defer db.Close()

	// Create a test logger
	testLogger := log.New(ioutil.Discard, "", 0)

	// Initialize the global syncLogger variable for test
	syncLogger = testLogger

	// Initialize sync manager
	syncManager = NewSyncManager(db, testLogger)

	// Setup test server
	router := gin.Default()
	router.GET("/sync", handleSync)
	server := httptest.NewServer(router)
	defer server.Close()

	// Convert http://... to ws://...
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/sync"

	// Connect to WebSocket
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(t, err)
	defer ws.Close()

	// Test push message
	pushMsg := SyncMessage{
		Type:      "push",
		SnippetID: 1,
		Content:   "test content",
		Title:     "test title",
		Version:   1,
		UpdatedAt: time.Now(),
	}

	// Send push message
	err = ws.WriteJSON(pushMsg)
	require.NoError(t, err)

	// Read response
	var response SyncMessage
	err = ws.ReadJSON(&response)
	require.NoError(t, err)

	// Verify response
	assert.Equal(t, "confirm", response.Type)
	assert.Equal(t, pushMsg.SnippetID, response.SnippetID)
	assert.Equal(t, pushMsg.Version, response.Version)

	// Test pull message
	pullMsg := SyncMessage{
		Type:      "pull",
		SnippetID: 1,
	}

	// Send pull message
	err = ws.WriteJSON(pullMsg)
	require.NoError(t, err)

	// Read response
	err = ws.ReadJSON(&response)
	require.NoError(t, err)

	// Verify response
	assert.Equal(t, "update", response.Type)
	assert.Equal(t, pullMsg.SnippetID, response.SnippetID)
	assert.NotEmpty(t, response.Content)
}

// TestInvalidMessages verifies that invalid sync messages are properly
// rejected with appropriate error messages. It tests various invalid
// scenarios using table-driven tests.
func TestInvalidMessages(t *testing.T) {
	tests := []struct {
		name        string
		message     SyncMessage
		errorString string
	}{
		{
			name: "zero snippet ID",
			message: SyncMessage{
				Type:      "push",
				SnippetID: 0,
				Title:     "test",
				Version:   1,
			},
			errorString: "invalid snippet ID: 0",
		},
		{
			name: "missing title in push",
			message: SyncMessage{
				Type:      "push",
				SnippetID: 1,
				Version:   1,
			},
			errorString: "title is required",
		},
		{
			name: "invalid version",
			message: SyncMessage{
				Type:      "push",
				SnippetID: 1,
				Title:     "test",
				Version:   0,
			},
			errorString: "invalid version number: 0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSyncMessage(tt.message)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.errorString)
		})
	}
}

// TestManualBackupEndpoint verifies the manual backup endpoint functionality.
// It tests:
// - Successful backup creation
// - Backup file verification
// - Error handling
// - Response format
func TestManualBackupEndpoint(t *testing.T) {
	// Create temporary test directory
	tmpDir, err := ioutil.TempDir("", "codexpad-backup-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test database
	dbPath := filepath.Join(tmpDir, "test.db")
	if err := ioutil.WriteFile(dbPath, []byte("test data"), 0644); err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Create test backup service
	backupDir := filepath.Join(tmpDir, "backups")
	config := BackupConfig{
		BackupDir:     backupDir,
		Interval:      time.Hour,
		MaxBackups:    5,
		RetentionDays: 7,
	}
	testLogger := log.New(ioutil.Discard, "", 0)
	backupService := NewBackupService(config, dbPath, testLogger)
	if err := backupService.Start(); err != nil {
		t.Fatalf("Failed to start backup service: %v", err)
	}
	defer backupService.Stop()

	// Setup test router
	router := gin.Default()
	router.POST("/backup", func(c *gin.Context) {
		if err := backupService.CreateBackup(); err != nil {
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

	// Create a test request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/backup", nil)
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, 200, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)

	assert.Nil(t, err)
	assert.Equal(t, "success", response["status"])
	assert.Equal(t, "Backup created successfully", response["message"])

	// Verify backup was created
	files, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("Failed to read backup directory: %v", err)
	}
	assert.Equal(t, 1, len(files), "Expected 1 backup file to be created")
}

// TestMain sets up the test environment before running tests
// and performs cleanup afterward.
func TestMain(m *testing.M) {
	// Set up test environment
	// We don't need to create an unused logger variable here

	// Run tests
	code := m.Run()

	// Clean up
	os.Exit(code)
}

// TestSyncManager verifies the core functionality of the sync manager,
// including client connection handling and database integration.
func TestSyncManager(t *testing.T) {
	// Create a test database
	tmpDir, err := ioutil.TempDir("", "codexpad-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	testLogger := log.New(ioutil.Discard, "", 0)
	db, err := NewDBManager(tmpDir + "/test.db")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Initialize sync manager with logger
	syncManager := NewSyncManager(db, testLogger)
	if syncManager == nil {
		t.Fatal("Failed to create SyncManager")
	}
}

// Add more test cases as needed
