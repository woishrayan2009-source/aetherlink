package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"

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

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"upload_id": md.UploadID})
}

// UploadHandler handles chunk upload with hash validation
func UploadHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	idxStr := c.Params("idx")
	idx, err := strconv.Atoi(idxStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("bad idx")
	}

	dir := filepath.Join(config.StorageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("upload not found")
	}

	if c.Request().Header.ContentLength() > config.MaxUploadSize {
		return c.Status(fiber.StatusRequestEntityTooLarge).SendString("too large")
	}

	// read metadata.json to get expected hash
	metaPath := filepath.Join(dir, "metadata.json")
	metaBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("meta not found")
	}
	var md models.Metadata
	if err := json.Unmarshal(metaBytes, &md); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("bad meta")
	}
	if idx < 0 || idx >= md.TotalChunks {
		return c.Status(fiber.StatusBadRequest).SendString("idx out of range")
	}
	expectedHash := ""
	if len(md.ChunkHashes) == md.TotalChunks {
		expectedHash = md.ChunkHashes[idx]
	}

	// read body bytes
	body := c.Body()
	if len(body) == 0 {
		return c.Status(fiber.StatusBadRequest).SendString("empty body")
	}

	// compute hash
	h := sha256.New()
	h.Write(body)
	actualHash := hex.EncodeToString(h.Sum(nil))

	// If expectedHash exists, verify
	if expectedHash != "" && expectedHash != actualHash {
		// mismatch — reject so client retries
		log.Printf("hash mismatch uploadID=%s idx=%d expected=%s actual=%s\n", uploadID, idx, expectedHash, actualHash)
		return c.Status(fiber.StatusBadRequest).SendString("chunk hash mismatch")
	}

	// write temp then move
	chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", idx))
	tmpPath := chunkPath + ".part"
	if err := os.WriteFile(tmpPath, body, 0644); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("write chunk failed")
	}
	// move to final chunk file (atomic if possible)
	if err := helpers.MoveFile(tmpPath, chunkPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("rename failed: " + err.Error())
	}
	// write .sha256 for convenience
	_ = os.WriteFile(chunkPath+".sha256", []byte(actualHash), 0644)

	// store priority if provided
	priority := c.Get("X-Priority")
	if priority == "" {
		priority = "normal"
	}
	_ = os.WriteFile(chunkPath+".prio", []byte(priority), 0644)

	// update received list
	if err := helpers.AppendReceivedChunk(dir, idx); err != nil {
		log.Println("warning appendReceivedChunk:", err)
	}

	// broadcast progress
	services.SSE.BroadcastProgress(uploadID, config.StorageRoot)

	return c.JSON(fiber.Map{"received_bytes": len(body), "chunk_hash": actualHash})
}

// StatusHandler returns the list of received chunks
func StatusHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(config.StorageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("upload not found")
	}
	received, _ := helpers.ReadReceivedChunks(dir)
	sort.Ints(received)
	return c.JSON(fiber.Map{"received_chunks": received})
}

// CompleteHandler assembles chunks into final file and verifies hash
func CompleteHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(config.StorageRoot, uploadID)
	metaPath := filepath.Join(dir, "metadata.json")
	mdBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("meta not found")
	}
	var md models.Metadata
	if err := json.Unmarshal(mdBytes, &md); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("bad meta")
	}

	outPath := filepath.Join(config.StorageRoot, uploadID, md.Filename)
	outTemp := outPath + ".part"
	out, err := os.Create(outTemp)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("create out failed")
	}

	hTotals := sha256.New()
	for i := 0; i < md.TotalChunks; i++ {
		chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", i))
		data, err := os.ReadFile(chunkPath)
		if err != nil {
			out.Close()
			return c.Status(fiber.StatusBadRequest).SendString(fmt.Sprintf("missing chunk %d", i))
		}
		_, _ = out.Write(data)
		_, _ = hTotals.Write(data)
	}
	finalHash := hex.EncodeToString(hTotals.Sum(nil))
	if md.FileHash != "" && md.FileHash != finalHash {
		out.Close()
		return c.Status(fiber.StatusBadRequest).SendString("overall hash mismatch")
	}
	if err := out.Close(); err != nil {
		log.Println("warning: closing assembled file failed:", err)
	}
	if err := os.Rename(outTemp, outPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("final rename failed: " + err.Error())
	}

	// broadcast completion
	services.SSE.BroadcastProgress(uploadID, config.StorageRoot)

	downloadURL := fmt.Sprintf("/static/%s/%s", uploadID, md.Filename)
	return c.JSON(fiber.Map{"status": "assembled", "file_path": outPath, "file_hash": finalHash, "download_url": downloadURL})
}

// HealthHandler returns health status
func HealthHandler(c *fiber.Ctx) error {
	return c.SendString("OK")
}
