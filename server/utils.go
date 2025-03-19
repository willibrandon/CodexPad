package main

import (
	"os"
	"path/filepath"
)

// readFile reads the contents of a file
func readFile(filename string) ([]byte, error) {
	// Get absolute path
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return nil, err
	}

	// Read file
	return os.ReadFile(absPath)
} 