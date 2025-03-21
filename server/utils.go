// Package main provides utility functions for file operations and other
// helper functionality used throughout the CodexPad sync server.
package main

import (
	"os"
	"path/filepath"
)

// readFile reads the contents of a file at the specified path.
// It first converts the path to an absolute path to ensure consistent
// file access regardless of the current working directory.
// Returns the file contents as a byte slice and any error encountered.
// Common errors include:
// - File not found
// - Permission denied
// - I/O errors
func readFile(filename string) ([]byte, error) {
	// Get absolute path
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return nil, err
	}

	// Read file
	return os.ReadFile(absPath)
}
