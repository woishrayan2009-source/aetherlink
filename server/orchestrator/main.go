package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

const storageRoot = "./storage"
const maxUploadSize = 1 << 30 // 1GB per request limit (safe guard)

type Metadata struct {
	UploadID    string   `json:"upload_id"`
	Filename    string   `json:"filename"`
	TotalChunks int      `json:"total_chunks"`
	ChunkSize   int64    `json:"chunk_size"`
	ChunkHashes []string `json:"chunk_hashes"` // optional, client-provided
	FileHash    string   `json:"file_hash"`    // optional overall hash
}

func main() {
	if err := os.MkdirAll(storageRoot, 0755); err != nil {
		log.Fatal(err)
	}

	app := fiber.New()

	// Enable CORS for the frontend running on localhost:3000
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})
	app.Post("/init", initHandler)                   // POST metadata -> create upload id
	app.Put("/upload/:uploadID/:idx", uploadHandler) // PUT /upload/{uploadID}/{idx}
	app.Get("/status/:uploadID", statusHandler)      // GET /status/{uploadID}
	app.Post("/complete/:uploadID", completeHandler) // POST /complete/{uploadID}
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
	// save metadata
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
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"upload_id": md.UploadID,
	})
}

func uploadHandler(c *fiber.Ctx) error {
	// Expected: PUT /upload/{uploadID}/{idx}
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

	// Check content length
	if c.Request().Header.ContentLength() > maxUploadSize {
		return c.Status(fiber.StatusRequestEntityTooLarge).SendString("too large")
	}

	// Get the request body (Fiber/fasthttp specific way)
	bodyData := c.Body()

	// read body and write file chunk
	chunkPath := filepath.Join(dir, fmt.Sprintf("chunk_%06d", idx))
	tmpPath := chunkPath + ".part"
	f, err := os.Create(tmpPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("create chunk failed")
	}

	// Write data and compute hash
	h := sha256.New()
	n, err := f.Write(bodyData)
	if err != nil {
		f.Close()
		return c.Status(fiber.StatusInternalServerError).SendString("write chunk failed: " + err.Error())
	}
	h.Write(bodyData)

	// Ensure the file is closed before attempting to move it.
	// On Windows you can't remove/rename a file that's still open by this process.
	if cerr := f.Close(); cerr != nil {
		// log a warning but prefer to return the original write error if any
		log.Println("warning: closing tmp chunk failed:", cerr)
	}

	// compute hash and save a small hash file for verification
	chunkHash := hex.EncodeToString(h.Sum(nil))
	if err := moveFile(tmpPath, chunkPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("rename failed")
	}
	if err := os.WriteFile(chunkPath+".sha256", []byte(chunkHash), 0644); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("hash write failed")
	}

	return c.JSON(fiber.Map{
		"received_bytes": n,
		"chunk_hash":     chunkHash,
	})
}

func statusHandler(c *fiber.Ctx) error {
	// GET /status/{uploadID}
	uploadID := c.Params("uploadID")
	dir := filepath.Join(storageRoot, uploadID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("upload not found")
	}
	files, _ := os.ReadDir(dir)
	received := make([]int, 0)
	for _, f := range files {
		name := f.Name()
		if len(name) > 6 && name[:6] == "chunk_" {
			// parse index
			var idx int
			_, err := fmt.Sscanf(name, "chunk_%06d", &idx)
			if err == nil {
				received = append(received, idx)
			}
		}
	}
	return c.JSON(fiber.Map{
		"received_chunks": received,
	})
}

func completeHandler(c *fiber.Ctx) error {
	// POST /complete/{uploadID}
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
	// assemble
	outPath := filepath.Join(storageRoot, uploadID, md.Filename)
	out, err := os.Create(outPath + ".part")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("create out failed")
	}
	// Don't use defer here - we need to close before rename on Windows

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
	// optional check with provided md.FileHash
	if md.FileHash != "" && md.FileHash != finalHash {
		out.Close()
		return c.Status(fiber.StatusBadRequest).SendString("overall hash mismatch")
	}

	// Close the output file before renaming (Windows requires this)
	if err := out.Close(); err != nil {
		log.Println("warning: closing assembled file failed:", err)
	}

	// Rename the assembled file to final name
	if err := os.Rename(outPath+".part", outPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("final rename failed: " + err.Error())
	}

	return c.JSON(fiber.Map{
		"status":    "assembled",
		"file_path": outPath,
		"file_hash": finalHash,
	})
}

// helpers
func moveFile(src, dst string) error {
	// Try os.Rename first (atomic, fast if same filesystem)
	if err := os.Rename(src, dst); err == nil {
		return nil
	}

	// Fallback to copy+remove for cross-filesystem moves
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

	// Explicitly close both files before attempting to remove source.
	// On Windows, os.Remove fails if the file is still open.
	input.Close()
	output.Close()

	if copyErr != nil {
		return copyErr
	}

	return os.Remove(src)
}
