package helpers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

var receivedLocks sync.Map // map[string]*sync.Mutex keyed by upload directory

// getReceivedLock returns a mutex for the given upload directory
func getReceivedLock(dir string) *sync.Mutex {
	lock, _ := receivedLocks.LoadOrStore(dir, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

// AppendReceivedChunk adds a chunk index to the received list (thread-safe)
func AppendReceivedChunk(dir string, idx int) error {
	lock := getReceivedLock(dir)
	lock.Lock()
	defer lock.Unlock()

	receivedPath := filepath.Join(dir, "received.json")
	var arr []int
	b, err := os.ReadFile(receivedPath)
	if err != nil {
		// If file doesn't exist, start with empty array
		if !os.IsNotExist(err) {
			return err
		}
	} else {
		if err := json.Unmarshal(b, &arr); err != nil {
			// If unmarshal fails, log and continue with empty array
			arr = []int{}
		}
	}

	// Check if already exists
	seen := false
	for _, v := range arr {
		if v == idx {
			seen = true
			break
		}
	}

	if !seen {
		arr = append(arr, idx)
		sort.Ints(arr)
		nb, err := json.Marshal(arr)
		if err != nil {
			return err
		}
		if err := os.WriteFile(receivedPath, nb, 0644); err != nil {
			return err
		}
	}
	return nil
}

// ReadReceivedChunks returns the list of received chunk indices (thread-safe)
func ReadReceivedChunks(dir string) ([]int, error) {
	lock := getReceivedLock(dir)
	lock.Lock()
	defer lock.Unlock()

	receivedPath := filepath.Join(dir, "received.json")
	b, err := os.ReadFile(receivedPath)
	if err != nil {
		return nil, err
	}
	var arr []int
	if err := json.Unmarshal(b, &arr); err != nil {
		return []int{}, err
	}
	return arr, nil
}
