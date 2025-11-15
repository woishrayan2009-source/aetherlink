package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"aetherlink/config"
	"aetherlink/helpers"
	"aetherlink/models"
	"aetherlink/services"

	"github.com/gofiber/fiber/v2"
)

// InitHandler initializes a new upload session
func InitHandler(c *fiber.Ctx) error {
	var md models.Metadata
	if err := c.BodyParser(&md); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("bad metadata: " + err.Error())
	}
	if md.UploadID == "" {
		return c.Status(fiber.StatusBadRequest).SendString("upload_id required")
	}
	// Generate unique share ID if not provided
	if md.ShareID == "" {
		md.ShareID = helpers.GenerateShareID()
	}
	dir := filepath.Join(config.StorageRoot, md.UploadID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("mkdir error")
	}
	metaPath := filepath.Join(dir, "metadata.json")
	f, err := os.Create(metaPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("create meta failed")
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(md); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("write meta failed")
	}

	// initialize received index tracking file (empty)
	receivedPath := filepath.Join(dir, "received.json")
	_ = os.WriteFile(receivedPath, []byte("[]"), 0644)

	// broadcast initial zero progress
	services.SSE.BroadcastProgress(md.UploadID, config.StorageRoot)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"upload_id": md.UploadID,
		"share_id":  md.ShareID,
	})
}

// UploadHandler handles chunk upload with hash validation and idempotency
func UploadHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	idxStr := c.Params("idx")
	idx, err := strconv.Atoi(idxStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("bad idx")
	}

	dir := filepath.Join(config.StorageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Upload session not found",
		})
	}

	if c.Request().Header.ContentLength() > config.MaxUploadSize {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
			"error": "Request entity too large",
		})
	}

	// read metadata.json to get expected hash
	metaPath := filepath.Join(dir, "metadata.json")
	metaBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Metadata not found",
		})
	}
	var md models.Metadata
	if err := json.Unmarshal(metaBytes, &md); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid metadata",
		})
	}
	if idx < 0 || idx >= md.TotalChunks {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Chunk index out of range",
		})
	}

	// Check if merged file already exists
	mergedPath := filepath.Join(dir, md.Filename)
	if _, err := os.Stat(mergedPath); err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Upload already completed",
		})
	}

	expectedHash := ""
	if len(md.ChunkHashes) == md.TotalChunks {
		expectedHash = md.ChunkHashes[idx]
	}

	// read body bytes
	body := c.Body()
	if len(body) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Empty body",
		})
	}

	// compute hash
	h := sha256.New()
	h.Write(body)
	actualHash := hex.EncodeToString(h.Sum(nil))

	// Check for idempotency - if chunk already exists
	var chunkExists bool
	var existingHash string

	if config.UseCloudStorage {
		// Check S3 for existing chunk
		chunkExists = helpers.ChunkExistsInS3(uploadID, idx)
		if chunkExists {
			// Download and verify hash
			existingData, err := helpers.DownloadChunkFromS3(uploadID, idx)
			if err == nil {
				h := sha256.New()
				h.Write(existingData)
				existingHash = hex.EncodeToString(h.Sum(nil))

				if existingHash == actualHash {
					log.Printf("[IDEMPOTENT] Chunk %d for upload %s already in S3 (hash match)", idx, uploadID)
					return c.JSON(fiber.Map{
						"status":         "already_received",
						"message":        fmt.Sprintf("Chunk %d already uploaded", idx),
						"received_bytes": len(existingData),
						"chunk_hash":     actualHash,
						"storage":        "s3",
					})
				}
			}
		}
	} else {
		// Check local filesystem
		chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", idx))
		if existingData, err := os.ReadFile(chunkPath); err == nil {
			existingHashBytes, _ := os.ReadFile(chunkPath + ".sha256")
			existingHash = string(existingHashBytes)

			if existingHash == actualHash {
				log.Printf("[IDEMPOTENT] Chunk %d for upload %s already received (hash match)", idx, uploadID)
				return c.JSON(fiber.Map{
					"status":         "already_received",
					"message":        fmt.Sprintf("Chunk %d already uploaded", idx),
					"received_bytes": len(existingData),
					"chunk_hash":     actualHash,
					"storage":        "local",
				})
			} else {
				log.Printf("[REPLACE] Chunk %d for upload %s has different hash, replacing", idx, uploadID)
			}
		}
	}

	// If expectedHash exists, verify
	if expectedHash != "" && expectedHash != actualHash {
		// mismatch — reject so client retries
		log.Printf("[HASH_MISMATCH] uploadID=%s idx=%d expected=%s actual=%s", uploadID, idx, expectedHash, actualHash)
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":    "Chunk hash mismatch",
			"expected": expectedHash,
			"actual":   actualHash,
		})
	}

	// Check disk space
	stat, err := os.Stat(config.StorageRoot)
	if err == nil {
		// This is a basic check - in production use syscall for actual disk space
		if stat.Size() < 0 {
			return c.Status(507).JSON(fiber.Map{
				"error": "Insufficient storage",
			})
		}
	}

	// Upload to cloud or local storage
	if config.UseCloudStorage {
		// Upload to S3
		log.Printf("[S3_UPLOAD] Uploading chunk %d for upload %s to S3", idx, uploadID)
		key, err := helpers.UploadChunkToS3(uploadID, idx, body)
		if err != nil {
			log.Printf("[S3_ERROR] Failed to upload chunk %d for upload %s: %v", idx, uploadID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to upload chunk to cloud storage: " + err.Error(),
			})
		}
		log.Printf("[S3_SUCCESS] Chunk %d uploaded to S3: %s", idx, key)
	} else {
		// Write to local filesystem
		chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", idx))
		tmpPath := chunkPath + ".part"
		if err := os.WriteFile(tmpPath, body, 0644); err != nil {
			log.Printf("[WRITE_ERROR] Failed to write chunk %d for upload %s: %v", idx, uploadID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to write chunk",
			})
		}
		// move to final chunk file (atomic if possible)
		if err := helpers.MoveFile(tmpPath, chunkPath); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to finalize chunk: " + err.Error(),
			})
		}
		// write .sha256 for convenience
		_ = os.WriteFile(chunkPath+".sha256", []byte(actualHash), 0644)
	}

	// update received list - critical operation, log error if it fails
	if err := helpers.AppendReceivedChunk(dir, idx); err != nil {
		log.Printf("[ERROR] Failed to update received chunks for upload %s, chunk %d: %v", uploadID, idx, err)
		// Don't fail the request since the chunk is saved, but log prominently
	}

	// broadcast progress
	services.SSE.BroadcastProgress(uploadID, config.StorageRoot)

	return c.JSON(fiber.Map{
		"status":         "received",
		"received_bytes": len(body),
		"chunk_hash":     actualHash,
	})
}

// StatusHandler returns the list of received chunks
func StatusHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(config.StorageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("upload not found")
	}
	received, _ := helpers.ReadReceivedChunks(dir)
	return c.JSON(fiber.Map{"received_chunks": received})
}

// CompleteHandler assembles chunks into final file and verifies hash
func CompleteHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(config.StorageRoot, uploadID)
	metaPath := filepath.Join(dir, "metadata.json")
	mdBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Metadata not found",
		})
	}
	var md models.Metadata
	if err := json.Unmarshal(mdBytes, &md); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid metadata",
		})
	}

	// Check if already completed
	outPath := filepath.Join(config.StorageRoot, uploadID, md.Filename)
	if _, err := os.Stat(outPath); err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Upload already completed",
		})
	}

	// Verify all chunks are present before merging
	received, err := helpers.ReadReceivedChunks(dir)
	if err != nil {
		log.Printf("[WARNING] Failed to read received.json for upload %s: %v. Will scan filesystem.", uploadID, err)
		received = []int{}
	}

	// Build set from received.json
	receivedSet := make(map[int]bool)
	for _, idx := range received {
		receivedSet[idx] = true
	}

	// Verify against actual filesystem/S3 as fallback (in case received.json was corrupted)
	missingChunks := []int{}
	for i := 0; i < md.TotalChunks; i++ {
		var exists bool
		if config.UseCloudStorage {
			exists = helpers.ChunkExistsInS3(uploadID, i)
		} else {
			chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", i))
			_, err := os.Stat(chunkPath)
			exists = !os.IsNotExist(err)
		}

		if !exists {
			missingChunks = append(missingChunks, i)
		} else {
			// Mark as received if file/object exists (handles corrupted received.json)
			receivedSet[i] = true
		}
	}

	if len(missingChunks) > 0 {
		log.Printf("[INCOMPLETE] Upload %s cannot be completed, missing chunks: %v", uploadID, missingChunks)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":         fmt.Sprintf("Missing chunks: %v", missingChunks),
			"missingChunks": missingChunks,
			"receivedCount": len(receivedSet),
			"totalChunks":   md.TotalChunks,
		})
	}

	// Assemble file from chunks
	var finalData []byte
	hTotals := sha256.New()

	if config.UseCloudStorage {
		// Download chunks from S3 and assemble in memory
		log.Printf("[S3_ASSEMBLE] Assembling %d chunks from S3 for upload %s", md.TotalChunks, uploadID)
		for i := 0; i < md.TotalChunks; i++ {
			data, err := helpers.DownloadChunkFromS3(uploadID, i)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": fmt.Sprintf("Failed to download chunk %d from S3: %v", i, err),
				})
			}
			finalData = append(finalData, data...)
			_, _ = hTotals.Write(data)
		}

		// Verify hash
		finalHash := hex.EncodeToString(hTotals.Sum(nil))
		if md.FileHash != "" && md.FileHash != finalHash {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Overall hash mismatch",
				"expected": md.FileHash,
				"actual":   finalHash,
			})
		}

		// Upload final file to S3
		s3Key, err := helpers.UploadFileToS3(uploadID, md.Filename, finalData)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to upload final file to S3: " + err.Error(),
			})
		}

		// Cleanup: delete individual chunks from S3
		log.Printf("[CLEANUP] Cleaning up %d chunks from S3 for upload %s", md.TotalChunks, uploadID)
		for i := 0; i < md.TotalChunks; i++ {
			if err := helpers.DeleteChunkFromS3(uploadID, i); err != nil {
				log.Printf("[WARNING] Failed to delete chunk %d from S3: %v", i, err)
			}
		}

		// Generate presigned URL for download (valid for 7 days)
		downloadURL, err := helpers.GetPresignedURL(uploadID, md.Filename, 7*24*time.Hour)
		if err != nil {
			log.Printf("[WARNING] Failed to generate presigned URL: %v", err)
			downloadURL = fmt.Sprintf("s3://%s/%s", config.AWSBucket, s3Key)
		}

		log.Printf("[COMPLETE] Upload %s assembled successfully in S3: %s", uploadID, md.Filename)

		return c.JSON(fiber.Map{
			"status":       "assembled",
			"file_hash":    finalHash,
			"download_url": downloadURL,
			"storage":      "s3",
			"s3_key":       s3Key,
		})
	} else {
		// Assemble from local filesystem
		outTemp := outPath + ".part"
		out, err := os.Create(outTemp)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to create output file",
			})
		}

		for i := 0; i < md.TotalChunks; i++ {
			chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", i))
			data, err := os.ReadFile(chunkPath)
			if err != nil {
				out.Close()
				os.Remove(outTemp)
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": fmt.Sprintf("Missing chunk %d", i),
				})
			}
			_, _ = out.Write(data)
			_, _ = hTotals.Write(data)
		}

		finalHash := hex.EncodeToString(hTotals.Sum(nil))
		if md.FileHash != "" && md.FileHash != finalHash {
			out.Close()
			os.Remove(outTemp)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Overall hash mismatch",
				"expected": md.FileHash,
				"actual":   finalHash,
			})
		}

		if err := out.Close(); err != nil {
			log.Println("[WARNING] closing assembled file failed:", err)
		}

		if err := os.Rename(outTemp, outPath); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Final rename failed: " + err.Error(),
			})
		}

		// Cleanup: delete individual chunks
		log.Printf("[CLEANUP] Cleaning up chunks for completed upload %s", uploadID)
		for i := 0; i < md.TotalChunks; i++ {
			chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", i))
			os.Remove(chunkPath)
			os.Remove(chunkPath + ".sha256")
		}

		log.Printf("[COMPLETE] Upload %s assembled successfully: %s", uploadID, md.Filename)

		downloadURL := fmt.Sprintf("/static/%s/%s", uploadID, md.Filename)
		return c.JSON(fiber.Map{
			"status":       "assembled",
			"file_path":    outPath,
			"file_hash":    finalHash,
			"download_url": downloadURL,
			"storage":      "local",
		})
	}
}

// HealthHandler returns health status
func HealthHandler(c *fiber.Ctx) error {
	return c.SendString("OK")
}

// CleanupHandler deletes an incomplete upload session
func CleanupHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(config.StorageRoot, uploadID)

	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Upload session not found",
		})
	}

	// Read metadata to check if merged file exists
	metaPath := filepath.Join(dir, "metadata.json")
	mdBytes, err := os.ReadFile(metaPath)
	if err == nil {
		var md models.Metadata
		if json.Unmarshal(mdBytes, &md) == nil {
			if config.UseCloudStorage {
				// Check S3 for completed file
				// For now, allow deletion (add check if needed)
			} else {
				mergedPath := filepath.Join(dir, md.Filename)
				if _, err := os.Stat(mergedPath); err == nil {
					return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
						"error": "Cannot delete completed upload",
					})
				}
			}
		}
	}

	// Delete from cloud storage if enabled
	if config.UseCloudStorage {
		log.Printf("[CLEANUP] Deleting upload %s from S3", uploadID)
		if err := helpers.DeleteUploadFromS3(uploadID); err != nil {
			log.Printf("[WARNING] Failed to delete from S3: %v", err)
		}
	}

	// Delete the local metadata directory
	if err := os.RemoveAll(dir); err != nil {
		log.Printf("[CLEANUP] Failed to delete upload %s: %v", uploadID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete upload session",
		})
	}

	log.Printf("[CLEANUP] Deleted upload session %s", uploadID)

	return c.JSON(fiber.Map{
		"message":  "Upload session deleted",
		"uploadID": uploadID,
	})
}

// FilesHandler lists files accessible by share ID
func FilesHandler(c *fiber.Ctx) error {
	shareID := c.Query("share_id")
	if shareID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "share_id required",
		})
	}

	type FileInfo struct {
		UploadID       string `json:"upload_id"`
		Filename       string `json:"filename"`
		TotalChunks    int    `json:"total_chunks"`
		ReceivedChunks int    `json:"received_chunks"`
		FileSize       int64  `json:"file_size"`
		UploadTime     string `json:"upload_time"`
		Status         string `json:"status"`
		ShareID        string `json:"share_id"`
	}

	files := []FileInfo{}

	// Read all directories in storage root
	entries, err := os.ReadDir(config.StorageRoot)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read storage directory",
		})
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		uploadID := entry.Name()
		dir := filepath.Join(config.StorageRoot, uploadID)
		metaPath := filepath.Join(dir, "metadata.json")

		// Read metadata
		mdBytes, err := os.ReadFile(metaPath)
		if err != nil {
			continue // Skip if no metadata
		}

		var md models.Metadata
		if err := json.Unmarshal(mdBytes, &md); err != nil {
			continue // Skip if invalid metadata
		}

		// Check if share ID matches
		if md.ShareID != shareID {
			continue // Skip files not shared with this ID
		}

		// Get file info
		fileInfo, err := entry.Info()
		if err != nil {
			continue
		}

		// Check if file is complete
		mergedPath := filepath.Join(dir, md.Filename)
		status := "incomplete"
		var fileSize int64

		if stat, err := os.Stat(mergedPath); err == nil {
			status = "complete"
			fileSize = stat.Size()
		} else {
			// Count received chunks
			received, _ := helpers.ReadReceivedChunks(dir)
			fileSize = int64(len(received)) * int64(md.ChunkSize)
		}

		// Get received chunks count
		received, _ := helpers.ReadReceivedChunks(dir)

		files = append(files, FileInfo{
			UploadID:       uploadID,
			Filename:       md.Filename,
			TotalChunks:    md.TotalChunks,
			ReceivedChunks: len(received),
			FileSize:       fileSize,
			UploadTime:     fileInfo.ModTime().Format(time.RFC3339),
			Status:         status,
			ShareID:        md.ShareID,
		})
	}

	return c.JSON(fiber.Map{
		"files":    files,
		"count":    len(files),
		"share_id": shareID,
	})
}
