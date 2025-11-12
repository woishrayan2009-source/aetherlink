package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"aetherlink/helpers"
	"aetherlink/models"
)

type SSEService struct {
	clients sync.RWMutex
	mm      map[string]map[chan string]struct{} // uploadID -> set of channels
}

var SSE = &SSEService{
	mm: make(map[string]map[chan string]struct{}),
}

// AddClient registers a new SSE client for an upload
func (s *SSEService) AddClient(uploadID string, ch chan string) {
	s.clients.Lock()
	defer s.clients.Unlock()
	if _, ok := s.mm[uploadID]; !ok {
		s.mm[uploadID] = make(map[chan string]struct{})
	}
	s.mm[uploadID][ch] = struct{}{}
}

// RemoveClient unregisters an SSE client
func (s *SSEService) RemoveClient(uploadID string, ch chan string) {
	s.clients.Lock()
	defer s.clients.Unlock()
	delete(s.mm[uploadID], ch)
	if len(s.mm[uploadID]) == 0 {
		delete(s.mm, uploadID)
	}
}

// BroadcastProgress sends progress update to all connected clients for an upload
func (s *SSEService) BroadcastProgress(uploadID string, storageRoot string) {
	dir := filepath.Join(storageRoot, uploadID)
	metaPath := filepath.Join(dir, "metadata.json")
	mdBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return
	}
	var md models.Metadata
	if err := json.Unmarshal(mdBytes, &md); err != nil {
		return
	}
	received, _ := helpers.ReadReceivedChunks(dir)
	sort.Ints(received)
	msgObj := map[string]interface{}{
		"upload_id":       uploadID,
		"filename":        md.Filename,
		"total_chunks":    md.TotalChunks,
		"received_chunks": received,
		"received_count":  len(received),
		"completed_percent": func() int {
			if md.TotalChunks == 0 {
				return 0
			}
			return int((len(received) * 100) / md.TotalChunks)
		}(),
	}
	bs, _ := json.Marshal(msgObj)

	s.clients.RLock()
	chs := s.mm[uploadID]
	s.clients.RUnlock()
	for ch := range chs {
		select {
		case ch <- string(bs):
		default:
			// avoid blocking
		}
	}
}
