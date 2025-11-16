package services

import (
	"aetherlink/config"
	"aetherlink/helpers"
	"aetherlink/models"
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const DefaultExpiryHours = 24

type RoomService struct {
	mu            sync.RWMutex
	roomClients   map[string]map[chan string]struct{} // shareID -> set of channels
	roomExpiryMap map[string]time.Time                // shareID -> expiresAt
}

var Room = &RoomService{
	roomClients:   make(map[string]map[chan string]struct{}),
	roomExpiryMap: make(map[string]time.Time),
}

// AddRoomClient registers a new client for room-level broadcasts
func (rs *RoomService) AddRoomClient(shareID string, ch chan string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if _, ok := rs.roomClients[shareID]; !ok {
		rs.roomClients[shareID] = make(map[chan string]struct{})
	}
	rs.roomClients[shareID][ch] = struct{}{}
}

// RemoveRoomClient unregisters a room client
func (rs *RoomService) RemoveRoomClient(shareID string, ch chan string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	delete(rs.roomClients[shareID], ch)
	if len(rs.roomClients[shareID]) == 0 {
		delete(rs.roomClients, shareID)
	}
}

// BroadcastRoomEvent sends an event to all clients connected to a room
func (rs *RoomService) BroadcastRoomEvent(event models.RoomEvent) {
	event.Timestamp = time.Now()
	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	rs.mu.RLock()
	clients := rs.roomClients[event.ShareID]
	// Copy channels to avoid holding lock during iteration
	channelsCopy := make([]chan string, 0, len(clients))
	for ch := range clients {
		channelsCopy = append(channelsCopy, ch)
	}
	rs.mu.RUnlock()

	// Broadcast without holding the lock
	for _, ch := range channelsCopy {
		// Use recover to handle closed channels gracefully
		func() {
			defer func() {
				if r := recover(); r != nil {
					// Channel was closed, ignore
				}
			}()
			select {
			case ch <- string(data):
			default:
				// avoid blocking
			}
		}()
	}
}

// GetRoomState builds the current state of a room
func (rs *RoomService) GetRoomState(shareID string) (*models.RoomState, error) {
	storageRoot := config.StorageRoot
	entries, err := ioutil.ReadDir(storageRoot)
	if err != nil {
		return nil, err
	}

	var activeUploads []models.UploadInfo
	var completedFiles []models.CompletedFile
	var lastUpdated time.Time

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		uploadID := entry.Name()
		metadataPath := filepath.Join(storageRoot, uploadID, "metadata.json")

		if _, err := os.Stat(metadataPath); os.IsNotExist(err) {
			continue
		}

		data, err := ioutil.ReadFile(metadataPath)
		if err != nil {
			continue
		}

		var md models.Metadata
		if err := json.Unmarshal(data, &md); err != nil {
			continue
		}

		// Filter by shareID
		if md.ShareID != shareID {
			continue
		}

		uploadDir := filepath.Join(storageRoot, uploadID)
		completedFilePath := filepath.Join(uploadDir, md.Filename)
		modTime := entry.ModTime()

		if modTime.After(lastUpdated) {
			lastUpdated = modTime
		}

		// Check if upload is complete
		if fileInfo, err := os.Stat(completedFilePath); err == nil {
			completedFiles = append(completedFiles, models.CompletedFile{
				UploadID:    uploadID,
				Filename:    md.Filename,
				FileSize:    fileInfo.Size(),
				CompletedAt: modTime,
			})
		} else {
			// Active upload
			received, _ := helpers.ReadReceivedChunks(uploadDir)
			completionPercent := 0
			if md.TotalChunks > 0 {
				completionPercent = (len(received) * 100) / md.TotalChunks
			}

			activeUploads = append(activeUploads, models.UploadInfo{
				UploadID:          uploadID,
				Filename:          md.Filename,
				TotalChunks:       md.TotalChunks,
				ReceivedChunks:    len(received),
				CompletionPercent: completionPercent,
				StartedAt:         modTime,
			})
		}
	}

	// Get or initialize expiry time
	expiresAt := rs.GetRoomExpiry(shareID)
	expiresIn := int64(time.Until(expiresAt).Seconds())
	if expiresIn < 0 {
		expiresIn = 0
	}

	return &models.RoomState{
		ShareID:        shareID,
		ActiveUploads:  activeUploads,
		CompletedFiles: completedFiles,
		LastUpdated:    lastUpdated,
		ExpiresAt:      expiresAt,
		ExpiresIn:      expiresIn,
	}, nil
}

// UpdateRoomExpiry resets the expiry timer for a room
func (rs *RoomService) UpdateRoomExpiry(shareID string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	rs.roomExpiryMap[shareID] = time.Now().Add(DefaultExpiryHours * time.Hour)
}

// GetRoomExpiry returns the expiry time for a room
func (rs *RoomService) GetRoomExpiry(shareID string) time.Time {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	if expiresAt, ok := rs.roomExpiryMap[shareID]; ok {
		return expiresAt
	}
	// Default: 24 hours from now
	return time.Now().Add(DefaultExpiryHours * time.Hour)
}

// NotifyUploadStart broadcasts upload start event
func (rs *RoomService) NotifyUploadStart(shareID, uploadID, filename string) {
	rs.UpdateRoomExpiry(shareID)
	rs.BroadcastRoomEvent(models.RoomEvent{
		Type:     "upload_start",
		ShareID:  shareID,
		UploadID: uploadID,
		Filename: filename,
	})
}

// NotifyChunkReceived broadcasts chunk received event
func (rs *RoomService) NotifyChunkReceived(shareID, uploadID string, received, total int) {
	rs.BroadcastRoomEvent(models.RoomEvent{
		Type:     "chunk_received",
		ShareID:  shareID,
		UploadID: uploadID,
		Data: map[string]interface{}{
			"received_chunks": received,
			"total_chunks":    total,
			"percent":         (received * 100) / total,
		},
	})
}

// NotifyUploadComplete broadcasts upload complete event
func (rs *RoomService) NotifyUploadComplete(shareID, uploadID, filename string, fileSize int64) {
	rs.BroadcastRoomEvent(models.RoomEvent{
		Type:     "upload_complete",
		ShareID:  shareID,
		UploadID: uploadID,
		Filename: filename,
		Data: map[string]interface{}{
			"file_size": fileSize,
		},
	})
}

// NotifyRoomStateUpdate broadcasts full room state update
func (rs *RoomService) NotifyRoomStateUpdate(shareID string) {
	state, err := rs.GetRoomState(shareID)
	if err != nil {
		return
	}
	rs.BroadcastRoomEvent(models.RoomEvent{
		Type:    "room_state",
		ShareID: shareID,
		Data:    state,
	})
}
