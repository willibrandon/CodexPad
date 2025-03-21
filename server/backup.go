// Package main provides the core functionality for the CodexPad sync server,
// including backup management, database operations, and WebSocket synchronization.
package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// BackupConfig defines the configuration parameters for the backup service.
// It controls where backups are stored, how often they are created,
// and the retention policy for managing backup files.
type BackupConfig struct {
	BackupDir     string        // Directory to store backups
	Interval      time.Duration // Backup interval between automatic backups
	MaxBackups    int           // Maximum number of backup files to retain
	RetentionDays int           // Number of days to keep backup files before deletion
}

// BackupService manages automated database backups and implements
// a retention policy for maintaining backup history. It provides
// both scheduled and manual backup capabilities.
type BackupService struct {
	config BackupConfig  // Service configuration
	dbPath string        // Path to the database file to backup
	logger *log.Logger   // Logger for backup operations
	stopCh chan struct{} // Channel for stopping the backup scheduler
}

// NewBackupService creates a new backup service instance with the specified
// configuration, database path, and logger. The service must be started
// with Start() to begin automated backups.
func NewBackupService(config BackupConfig, dbPath string, logger *log.Logger) *BackupService {
	return &BackupService{
		config: config,
		dbPath: dbPath,
		logger: logger,
		stopCh: make(chan struct{}),
	}
}

// Start begins the backup scheduler and creates the backup directory if it doesn't exist.
// It returns an error if the backup directory cannot be created.
// The backup service will continue running until Stop() is called.
func (bs *BackupService) Start() error {
	// Create backup directory if it doesn't exist
	if err := os.MkdirAll(bs.config.BackupDir, 0755); err != nil {
		return fmt.Errorf("failed to create backup directory: %v", err)
	}

	// Start backup scheduler
	go bs.scheduleBackups()
	return nil
}

// Stop gracefully shuts down the backup scheduler.
// Any in-progress backup will complete before the service stops.
func (bs *BackupService) Stop() {
	close(bs.stopCh)
}

// scheduleBackups runs the backup scheduler in a goroutine.
// It creates backups at the configured interval and handles cleanup
// of old backups according to the retention policy.
func (bs *BackupService) scheduleBackups() {
	ticker := time.NewTicker(bs.config.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := bs.CreateBackup(); err != nil {
				bs.logger.Printf("[ERROR] Backup failed: %v", err)
			}
		case <-bs.stopCh:
			return
		}
	}
}

// CreateBackup creates a new backup of the database file.
// The backup is stored in the configured backup directory with a timestamp-based filename.
// After creating the backup, it triggers cleanup of old backups based on retention policy.
// Returns an error if the backup operation fails.
func (bs *BackupService) CreateBackup() error {
	// Generate backup filename with timestamp
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	backupPath := filepath.Join(bs.config.BackupDir, fmt.Sprintf("codexpad_%s.db", timestamp))

	// Copy database file
	if err := bs.copyFile(bs.dbPath, backupPath); err != nil {
		return fmt.Errorf("failed to create backup: %v", err)
	}

	bs.logger.Printf("[BACKUP] Created backup: %s", backupPath)

	// Cleanup old backups
	if err := bs.cleanupOldBackups(); err != nil {
		bs.logger.Printf("[ERROR] Failed to cleanup old backups: %v", err)
	}

	return nil
}

// copyFile copies a file from src to dst, ensuring all data is written
// and synced to disk before returning. Returns an error if any operation fails.
func (bs *BackupService) copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return err
	}

	return destFile.Sync()
}

// cleanupOldBackups removes old backup files based on the configured retention policy.
// It enforces both the maximum number of backups and the retention period in days.
// Files are sorted by modification time, and the oldest files exceeding the limits
// are removed. Any errors during cleanup are logged but don't stop the process.
func (bs *BackupService) cleanupOldBackups() error {
	files, err := os.ReadDir(bs.config.BackupDir)
	if err != nil {
		return err
	}

	var backups []string
	for _, file := range files {
		if filepath.Ext(file.Name()) == ".db" {
			backups = append(backups, filepath.Join(bs.config.BackupDir, file.Name()))
		}
	}

	// Sort backups by modification time (newest first)
	sort.Slice(backups, func(i, j int) bool {
		iInfo, _ := os.Stat(backups[i])
		jInfo, _ := os.Stat(backups[j])
		return iInfo.ModTime().After(jInfo.ModTime())
	})

	// Remove old backups based on MaxBackups
	if len(backups) > bs.config.MaxBackups {
		for _, backup := range backups[bs.config.MaxBackups:] {
			if err := os.Remove(backup); err != nil {
				bs.logger.Printf("[ERROR] Failed to remove old backup %s: %v", backup, err)
				continue
			}
			bs.logger.Printf("[BACKUP] Removed old backup: %s", backup)
		}
	}

	// Remove backups older than RetentionDays
	cutoff := time.Now().AddDate(0, 0, -bs.config.RetentionDays)
	for _, backup := range backups {
		info, err := os.Stat(backup)
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			if err := os.Remove(backup); err != nil {
				bs.logger.Printf("[ERROR] Failed to remove expired backup %s: %v", backup, err)
				continue
			}
			bs.logger.Printf("[BACKUP] Removed expired backup: %s", backup)
		}
	}

	return nil
}
