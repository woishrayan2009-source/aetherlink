package helpers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
)

// AppendReceivedChunk adds a chunk index to the received list
func AppendReceivedChunk(dir string, idx int) error {
	receivedPath := filepath.Join(dir, "received.json")
	var arr []int
	b, _ := os.ReadFile(receivedPath)
	_ = json.Unmarshal(b, &arr)
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
		nb, _ := json.Marshal(arr)
		return os.WriteFile(receivedPath, nb, 0644)
	}
	return nil
}

// ReadReceivedChunks returns the list of received chunk indices
func ReadReceivedChunks(dir string) ([]int, error) {
	receivedPath := filepath.Join(dir, "received.json")
	b, err := os.ReadFile(receivedPath)
	if err != nil {
		return nil, err
	}
	var arr []int
	_ = json.Unmarshal(b, &arr)
	return arr, nil
}
