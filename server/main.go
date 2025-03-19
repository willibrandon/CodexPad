package main

import (
	"log"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
)

// ServerStats represents our server statistics
// The `json:` tags tell Go how to convert to JSON
type ServerStats struct {
	Uptime       string    `json:"uptime"`
	NumGoroutine int       `json:"num_goroutines"`
	NumCPU       int       `json:"num_cpu"`
	StartTime    time.Time `json:"start_time"`
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

	// Start the server on port 8080
	log.Println("Starting CodexPad sync server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
} 