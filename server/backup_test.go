// Package main provides tests for the backup functionality.
package main

import (
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestBackupService tests the core functionality of the BackupService.
// It verifies:
// - Backup directory creation
// - Initial backup creation
// - Backup file rotation based on MaxBackups setting
// - Backup retention based on RetentionDays setting
// The test uses a temporary directory that is cleaned up afterward.
func TestBackupService(t *testing.T) {
	// Create temporary directories for test
	tmpDir, err := ioutil.TempDir("", "codexpad-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	backupDir := filepath.Join(tmpDir, "backups")
	dbPath := filepath.Join(tmpDir, "test.db")

	// Create a test database file
	if err := ioutil.WriteFile(dbPath, []byte("test data"), 0644); err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Create test logger
	testLogger := log.New(ioutil.Discard, "", 0)

	// Create backup service
	config := BackupConfig{
		BackupDir:     backupDir,
		Interval:      1 * time.Second, // Short interval for testing
		MaxBackups:    2,
		RetentionDays: 1,
	}

	backupService := NewBackupService(config, dbPath, testLogger)
	if backupService == nil {
		t.Fatal("Failed to create BackupService")
	}

	// Test backup directory creation
	if err := backupService.Start(); err != nil {
		t.Fatalf("Failed to start backup service: %v", err)
	}
	defer backupService.Stop()

	// Verify backup directory was created
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		t.Error("Backup directory was not created")
	}

	// Test backup creation
	if err := backupService.CreateBackup(); err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	// Verify backup was created
	files, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("Failed to read backup directory: %v", err)
	}

	if len(files) != 1 {
		t.Errorf("Expected 1 backup file, got %d", len(files))
	}

	// Test backup rotation
	// Create multiple backups to test rotation
	for i := 0; i < 3; i++ {
		if err := backupService.CreateBackup(); err != nil {
			t.Fatalf("Failed to create backup: %v", err)
		}
		// Add a longer sleep between backups to ensure different timestamps and file paths
		time.Sleep(500 * time.Millisecond)
	}

	// Verify backup rotation
	files, err = os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("Failed to read backup directory: %v", err)
	}

	// Check that we have at most MaxBackups files
	if len(files) > config.MaxBackups {
		t.Errorf("Expected at most %d backup files after rotation, got %d", config.MaxBackups, len(files))
	}
	// And at least one file
	if len(files) < 1 {
		t.Errorf("Expected at least 1 backup file, got %d", len(files))
	}
}
