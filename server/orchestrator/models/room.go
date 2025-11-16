package models

import "time"

// RoomState represents the shared state of a multi-user room
type RoomState struct {
	ShareID        string          `json:"share_id"`
	ActiveUploads  []UploadInfo    `json:"active_uploads"`
	CompletedFiles []CompletedFile `json:"completed_files"`
	LastUpdated    time.Time       `json:"last_updated"`
	ExpiresAt      time.Time       `json:"expires_at"`
	ExpiresIn      int64           `json:"expires_in"` // seconds until expiry
}

// UploadInfo represents an active upload in a room
type UploadInfo struct {
	UploadID          string    `json:"upload_id"`
	Filename          string    `json:"filename"`
	TotalChunks       int       `json:"total_chunks"`
	ReceivedChunks    int       `json:"received_chunks"`
	CompletionPercent int       `json:"completion_percent"`
	StartedAt         time.Time `json:"started_at"`
}

// CompletedFile represents a completed upload in a room
type CompletedFile struct {
	UploadID    string    `json:"upload_id"`
	Filename    string    `json:"filename"`
	FileSize    int64     `json:"file_size"`
	CompletedAt time.Time `json:"completed_at"`
}

// RoomEvent represents a broadcast event for room updates
type RoomEvent struct {
	Type      string      `json:"type"` // "upload_start", "chunk_received", "upload_complete", "room_state"
	ShareID   string      `json:"share_id"`
	UploadID  string      `json:"upload_id,omitempty"`
	Filename  string      `json:"filename,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}
