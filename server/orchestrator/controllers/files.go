package controllers

import (
	"aetherlink/config"
	"aetherlink/models"
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/gofiber/fiber/v2"
)

type FileMetadata struct {
	UploadID             string    `json:"upload_id"`
	Filename             string    `json:"filename"`
	TotalChunks          int       `json:"total_chunks"`
	ReceivedChunks       int       `json:"received_chunks"`
	FileSize             int64     `json:"file_size"`
	UploadTime           time.Time `json:"upload_time"`
	Status               string    `json:"status"`
	CompletionPercentage float64   `json:"completion_percentage"`
}

type FilesResponse struct {
	Files []FileMetadata `json:"files"`
	Count int            `json:"count"`
}

// FilesHandler returns a list of files for a specific share ID
func FilesHandler(c *fiber.Ctx) error {
	shareID := c.Query("share_id")
	if shareID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "share_id is required. Please provide a share_id query parameter.",
		})
	}

	storageRoot := config.StorageRoot

	// Read all directories in storage root
	entries, err := ioutil.ReadDir(storageRoot)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read storage directory",
		})
	}

	var files []FileMetadata

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		uploadID := entry.Name()
		metadataPath := filepath.Join(storageRoot, uploadID, "metadata.json")

		// Check if metadata exists
		if _, err := os.Stat(metadataPath); os.IsNotExist(err) {
			continue
		}

		// Read metadata
		data, err := ioutil.ReadFile(metadataPath)
		if err != nil {
			continue
		}

		var metadata models.Metadata
		if err := json.Unmarshal(data, &metadata); err != nil {
			continue
		}

		// Filter by share ID - only return files matching the provided share ID
		if metadata.ShareID != shareID {
			continue
		}

		// Count received chunks from received.json
		receivedPath := filepath.Join(storageRoot, uploadID, "received.json")
		receivedChunks := 0

		if receivedData, err := ioutil.ReadFile(receivedPath); err == nil {
			var receivedIndices []int
			if err := json.Unmarshal(receivedData, &receivedIndices); err == nil {
				receivedChunks = len(receivedIndices)
			}
		}

		// Determine file size and check completion
		completedFilePath := filepath.Join(storageRoot, uploadID, metadata.Filename)

		// If received.json doesn't exist but file is complete, assume all chunks received
		if receivedChunks == 0 {
			if _, err := os.Stat(completedFilePath); err == nil {
				// Complete file exists, so all chunks were received
				receivedChunks = metadata.TotalChunks
			}
		}

		// Determine file size
		var fileSize int64 = 0
		if fileInfo, err := os.Stat(completedFilePath); err == nil {
			fileSize = fileInfo.Size()
		} else {
			// Estimate from chunks
			fileSize = int64(metadata.TotalChunks) * metadata.ChunkSize
		}

		// Determine status
		status := "incomplete"
		if receivedChunks >= metadata.TotalChunks {
			// Check if complete file exists
			if _, err := os.Stat(completedFilePath); err == nil {
				status = "complete"
			}
		}

		// Calculate completion percentage
		completionPercentage := 0.0
		if metadata.TotalChunks > 0 {
			completionPercentage = (float64(receivedChunks) / float64(metadata.TotalChunks)) * 100
		}

		// Get upload time (use directory creation time)
		uploadTime := entry.ModTime()

		files = append(files, FileMetadata{
			UploadID:             uploadID,
			Filename:             metadata.Filename,
			TotalChunks:          metadata.TotalChunks,
			ReceivedChunks:       receivedChunks,
			FileSize:             fileSize,
			UploadTime:           uploadTime,
			Status:               status,
			CompletionPercentage: completionPercentage,
		})
	}

	// Sort by upload time (newest first)
	sort.Slice(files, func(i, j int) bool {
		return files[i].UploadTime.After(files[j].UploadTime)
	})

	return c.JSON(FilesResponse{
		Files: files,
		Count: len(files),
	})
}

// FileInfoHandler returns detailed information about a specific file
func FileInfoHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	shareID := c.Query("share_id")

	if uploadID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "upload_id is required",
		})
	}

	if shareID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "share_id is required",
		})
	}

	storageRoot := config.StorageRoot
	uploadDir := filepath.Join(storageRoot, uploadID)
	metadataPath := filepath.Join(uploadDir, "metadata.json")

	// Check if metadata exists
	if _, err := os.Stat(metadataPath); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "File not found",
		})
	}

	// Read metadata
	data, err := ioutil.ReadFile(metadataPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read metadata",
		})
	}

	var metadata models.Metadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to parse metadata",
		})
	}

	// Verify share ID matches
	if metadata.ShareID != shareID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied. Invalid share ID.",
		})
	}

	// Count received chunks from received.json
	receivedPath := filepath.Join(uploadDir, "received.json")
	receivedChunks := 0

	if receivedData, err := ioutil.ReadFile(receivedPath); err == nil {
		var receivedIndices []int
		if err := json.Unmarshal(receivedData, &receivedIndices); err == nil {
			receivedChunks = len(receivedIndices)
		}
	}

	// If received.json doesn't exist but file is complete, assume all chunks received
	completedFilePath := filepath.Join(uploadDir, metadata.Filename)
	if receivedChunks == 0 {
		if _, err := os.Stat(completedFilePath); err == nil {
			receivedChunks = metadata.TotalChunks
		}
	}

	// Determine file size
	var fileSize int64 = 0
	if fileInfo, err := os.Stat(completedFilePath); err == nil {
		fileSize = fileInfo.Size()
	}

	// Determine status
	status := "incomplete"
	if receivedChunks >= metadata.TotalChunks {
		if _, err := os.Stat(completedFilePath); err == nil {
			status = "complete"
		}
	}

	// Calculate completion percentage
	completionPercentage := 0.0
	if metadata.TotalChunks > 0 {
		completionPercentage = (float64(receivedChunks) / float64(metadata.TotalChunks)) * 100
	}

	// Get upload time
	if dirInfo, err := os.Stat(uploadDir); err == nil {
		return c.JSON(FileMetadata{
			UploadID:             uploadID,
			Filename:             metadata.Filename,
			TotalChunks:          metadata.TotalChunks,
			ReceivedChunks:       receivedChunks,
			FileSize:             fileSize,
			UploadTime:           dirInfo.ModTime(),
			Status:               status,
			CompletionPercentage: completionPercentage,
		})
	}

	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"error": "Failed to get file info",
	})
}

// SecureDownloadHandler allows downloading files only with valid share ID
func SecureDownloadHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	filename := c.Params("filename")
	shareID := c.Query("share_id")

	if shareID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "share_id is required",
		})
	}

	storageRoot := config.StorageRoot
	uploadDir := filepath.Join(storageRoot, uploadID)
	metadataPath := filepath.Join(uploadDir, "metadata.json")

	// Read and verify metadata
	data, err := ioutil.ReadFile(metadataPath)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "File not found",
		})
	}

	var metadata models.Metadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid metadata",
		})
	}

	// Verify share ID
	if metadata.ShareID != shareID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied. Invalid share ID.",
		})
	}

	// Serve the file
	filePath := filepath.Join(uploadDir, filename)
	return c.SendFile(filePath)
}
