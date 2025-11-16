package controllers

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/cespare/xxhash/v2"

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

	// Notify room of upload start
	services.Room.NotifyUploadStart(md.ShareID, md.UploadID, md.Filename)

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
	h := xxhash.New()
	h.Write(body)
	actualHash := hex.EncodeToString(h.Sum(nil))

	// Check for idempotency - if chunk already exists
	chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", idx))
	if existingData, err := os.ReadFile(chunkPath); err == nil {
		// Chunk already exists, check hash
		existingHashBytes, _ := os.ReadFile(chunkPath + ".xxhash")
		existingHash := string(existingHashBytes)

		if existingHash == actualHash {
			// Same chunk, return success without rewriting
			log.Printf("[IDEMPOTENT] Chunk %d for upload %s already received (hash match)", idx, uploadID)
			return c.JSON(fiber.Map{
				"status":         "already_received",
				"message":        fmt.Sprintf("Chunk %d already uploaded", idx),
				"received_bytes": len(existingData),
				"chunk_hash":     actualHash,
			})
		} else {
			// Different chunk, will overwrite
			log.Printf("[REPLACE] Chunk %d for upload %s has different hash, replacing", idx, uploadID)
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

	// write temp then move
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
	// write .xxhash for convenience
	_ = os.WriteFile(chunkPath+".xxhash", []byte(actualHash), 0644)

	// update received list
	if err := helpers.AppendReceivedChunk(dir, idx); err != nil {
		log.Println("warning appendReceivedChunk:", err)
	}

	// broadcast progress
	services.SSE.BroadcastProgress(uploadID, config.StorageRoot)

	// Notify room of chunk received
	received, _ := helpers.ReadReceivedChunks(dir)
	services.Room.NotifyChunkReceived(md.ShareID, uploadID, len(received), md.TotalChunks)

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
	received, _ := helpers.ReadReceivedChunks(dir)
	receivedSet := make(map[int]bool)
	for _, idx := range received {
		receivedSet[idx] = true
	}

	missingChunks := []int{}
	for i := 0; i < md.TotalChunks; i++ {
		if !receivedSet[i] {
			missingChunks = append(missingChunks, i)
		}
	}

	if len(missingChunks) > 0 {
		log.Printf("[INCOMPLETE] Upload %s cannot be completed, missing chunks: %v", uploadID, missingChunks)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":         fmt.Sprintf("Missing chunks: %v", missingChunks),
			"missingChunks": missingChunks,
			"receivedCount": len(received),
			"totalChunks":   md.TotalChunks,
		})
	}

	outTemp := outPath + ".part"
	out, err := os.Create(outTemp)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create output file",
		})
	}

	hTotals := xxhash.New()
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

	// Cleanup: delete individual chunks and metadata files
	log.Printf("[CLEANUP] Cleaning up chunks for completed upload %s", uploadID)
	for i := 0; i < md.TotalChunks; i++ {
		chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", i))
		os.Remove(chunkPath)
		os.Remove(chunkPath + ".xxhash")
	}
	os.Remove(filepath.Join(dir, "received.json"))

	// broadcast completion
	services.SSE.BroadcastProgress(uploadID, config.StorageRoot)

	// Notify room of upload complete
	if fileInfo, err := os.Stat(outPath); err == nil {
		services.Room.NotifyUploadComplete(md.ShareID, uploadID, md.Filename, fileInfo.Size())
	}

	log.Printf("[COMPLETE] Upload %s assembled successfully: %s", uploadID, md.Filename)

	downloadURL := fmt.Sprintf("/static/%s/%s", uploadID, md.Filename)
	return c.JSON(fiber.Map{
		"status":       "assembled",
		"file_path":    outPath,
		"file_hash":    finalHash,
		"download_url": downloadURL,
	})
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
			mergedPath := filepath.Join(dir, md.Filename)
			if _, err := os.Stat(mergedPath); err == nil {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "Cannot delete completed upload",
				})
			}
		}
	}

	// Delete the entire directory
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
