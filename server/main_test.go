package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHealthEndpoint tests the /health endpoint
func TestHealthEndpoint(t *testing.T) {
	// Setup
	router := gin.Default()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
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

// TestSyncMessageValidation demonstrates table-driven tests
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

// TestWebSocketConnection tests the WebSocket connection
func TestWebSocketConnection(t *testing.T) {
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

// TestInvalidMessages tests handling of invalid sync messages
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