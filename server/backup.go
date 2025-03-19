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

type BackupConfig struct {
	BackupDir     string        // Directory to store backups
	Interval      time.Duration // Backup interval
	MaxBackups    int           // Maximum number of backups to keep
	RetentionDays int          // Number of days to keep backups
}

type BackupService struct {
	config  BackupConfig
	dbPath  string
	logger  *log.Logger
	stopCh  chan struct{}
}

func NewBackupService(config BackupConfig, dbPath string, logger *log.Logger) *BackupService {
	return &BackupService{
		config:  config,
		dbPath:  dbPath,
		logger:  logger,
		stopCh:  make(chan struct{}),
	}
}

// Start begins the backup scheduler
func (bs *BackupService) Start() error {
	// Create backup directory if it doesn't exist
	if err := os.MkdirAll(bs.config.BackupDir, 0755); err != nil {
		return fmt.Errorf("failed to create backup directory: %v", err)
	}

	// Start backup scheduler
	go bs.scheduleBackups()
	return nil
}

// Stop stops the backup scheduler
func (bs *BackupService) Stop() {
	close(bs.stopCh)
}

// scheduleBackups runs the backup scheduler
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

// CreateBackup creates a new backup of the database
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

// copyFile copies a file from src to dst
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

// cleanupOldBackups removes old backups based on retention policy
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