package helpers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
)

// GenerateShareID generates a unique share ID for file access control
func GenerateShareID() string {
	b := make([]byte, 16) // 16 bytes = 32 hex characters
	rand.Read(b)
	return hex.EncodeToString(b)
}

// MoveFile moves a file from src to dst, with fallback to copy+delete
func MoveFile(src, dst string) error {
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	input, err := os.Open(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		input.Close()
		return err
	}
	output, err := os.Create(dst)
	if err != nil {
		input.Close()
		return err
	}
	_, copyErr := io.Copy(output, input)
	input.Close()
	output.Close()
	if copyErr != nil {
		return copyErr
	}
	return os.Remove(src)
}
