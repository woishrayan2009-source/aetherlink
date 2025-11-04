package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

const storageRoot = "./storage"
const maxUploadSize = 1 << 30 // 1GB per request limit

type Metadata struct {
	UploadID    string   `json:"upload_id"`
	Filename    string   `json:"filename"`
	TotalChunks int      `json:"total_chunks"`
	ChunkSize   int64    `json:"chunk_size"`
	ChunkHashes []string `json:"chunk_hashes"` // client-provided expected hashes
	FileHash    string   `json:"file_hash"`    // overall file hash
}

var sseClients = struct {
	m  sync.RWMutex
	mm map[string]map[chan string]struct{} // uploadID -> set of channels
}{mm: make(map[string]map[chan string]struct{})}

func main() {
	if err := os.MkdirAll(storageRoot, 0755); err != nil {
		log.Fatal(err)
	}

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000", // adjust for your frontends
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Priority",
		AllowCredentials: true,
	}))

	app.Get("/health", func(c *fiber.Ctx) error { return c.SendString("OK") })
	app.Post("/init", initHandler)
	app.Put("/upload/:uploadID/:idx", uploadHandler)
	app.Get("/status/:uploadID", statusHandler)
	app.Post("/complete/:uploadID", completeHandler)
	app.Get("/events/:uploadID", sseHandler)
	app.Static("/static", storageRoot)

	log.Println("Server listening on :8080")
	log.Fatal(app.Listen(":8080"))
}

func initHandler(c *fiber.Ctx) error {
	var md Metadata
	if err := c.BodyParser(&md); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("bad metadata: " + err.Error())
	}
	if md.UploadID == "" {
		return c.Status(fiber.StatusBadRequest).SendString("upload_id required")
	}
	dir := filepath.Join(storageRoot, md.UploadID)
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
	broadcastProgress(md.UploadID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"upload_id": md.UploadID})
}

func uploadHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	idxStr := c.Params("idx")
	idx, err := strconv.Atoi(idxStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("bad idx")
	}

	dir := filepath.Join(storageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("upload not found")
	}

	if c.Request().Header.ContentLength() > maxUploadSize {
		return c.Status(fiber.StatusRequestEntityTooLarge).SendString("too large")
	}

	// read metadata.json to get expected hash
	metaPath := filepath.Join(dir, "metadata.json")
	metaBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("meta not found")
	}
	var md Metadata
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
	if err := moveFile(tmpPath, chunkPath); err != nil {
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
	if err := appendReceivedChunk(dir, idx); err != nil {
		log.Println("warning appendReceivedChunk:", err)
	}

	// broadcast progress
	broadcastProgress(uploadID)

	return c.JSON(fiber.Map{"received_bytes": len(body), "chunk_hash": actualHash})
}

func statusHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(storageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("upload not found")
	}
	received, _ := readReceivedChunks(dir)
	sort.Ints(received)
	return c.JSON(fiber.Map{"received_chunks": received})
}

func completeHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")
	dir := filepath.Join(storageRoot, uploadID)
	metaPath := filepath.Join(dir, "metadata.json")
	mdBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("meta not found")
	}
	var md Metadata
	if err := json.Unmarshal(mdBytes, &md); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("bad meta")
	}

	outPath := filepath.Join(storageRoot, uploadID, md.Filename)
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
	broadcastProgress(uploadID)

	downloadURL := fmt.Sprintf("/static/%s/%s", uploadID, md.Filename)
	return c.JSON(fiber.Map{"status": "assembled", "file_path": outPath, "file_hash": finalHash, "download_url": downloadURL})
}

// helpers

func moveFile(src, dst string) error {
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

func appendReceivedChunk(dir string, idx int) error {
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

func readReceivedChunks(dir string) ([]int, error) {
	receivedPath := filepath.Join(dir, "received.json")
	b, err := os.ReadFile(receivedPath)
	if err != nil {
		return nil, err
	}
	var arr []int
	_ = json.Unmarshal(b, &arr)
	return arr, nil
}

// SSE: simple Server-Sent Events implementation for progress updates
func sseHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	ch := make(chan string, 10)
	done := make(chan struct{})

	sseClients.m.Lock()
	if _, ok := sseClients.mm[uploadID]; !ok {
		sseClients.mm[uploadID] = make(map[chan string]struct{})
	}
	sseClients.mm[uploadID][ch] = struct{}{}
	sseClients.m.Unlock()

	// send initial progress once
	go func() {
		time.Sleep(10 * time.Millisecond)
		broadcastProgress(uploadID)
	}()

	// keep connection open and send messages
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		// cleanup on disconnect
		defer func() {
			close(done)
			sseClients.m.Lock()
			delete(sseClients.mm[uploadID], ch)
			if len(sseClients.mm[uploadID]) == 0 {
				delete(sseClients.mm, uploadID)
			}
			sseClients.m.Unlock()
			close(ch)
		}()

		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}
				// write as SSE "data: <json>\n\n"
				fmt.Fprintf(w, "data: %s\n\n", msg)
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				// send keepalive comment
				fmt.Fprintf(w, ": keepalive\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			case <-done:
				// connection closed
				return
			}
		}
	})

	return nil
}

func broadcastProgress(uploadID string) {
	dir := filepath.Join(storageRoot, uploadID)
	metaPath := filepath.Join(dir, "metadata.json")
	mdBytes, err := os.ReadFile(metaPath)
	if err != nil {
		return
	}
	var md Metadata
	if err := json.Unmarshal(mdBytes, &md); err != nil {
		return
	}
	received, _ := readReceivedChunks(dir)
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

	sseClients.m.RLock()
	chs := sseClients.mm[uploadID]
	sseClients.m.RUnlock()
	for ch := range chs {
		select {
		case ch <- string(bs):
		default:
			// avoid blocking
		}
	}
}
