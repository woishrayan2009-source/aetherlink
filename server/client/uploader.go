package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

const chunkSize int64 = 5 * 1024 // 5 KB
const serverBase = "http://localhost:8080"
const maxWorkers = 4
const retryLimit = 5

type Metadata struct {
	UploadID    string   `json:"upload_id"`
	Filename    string   `json:"filename"`
	TotalChunks int      `json:"total_chunks"`
	ChunkSize   int64    `json:"chunk_size"`
	ChunkHashes []string `json:"chunk_hashes"`
	FileHash    string   `json:"file_hash"`
}

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: uploader <upload-id> <file-path>")
		return
	}
	uploadID := os.Args[1]
	filePath := os.Args[2]

	if err := uploadFile(uploadID, filePath); err != nil {
		log.Fatal(err)
	}
}

func uploadFile(uploadID, path string) error {
	finfo, err := os.Stat(path)
	if err != nil {
		return err
	}
	fileSize := finfo.Size()
	fmt.Printf("Uploading file: %s (%d bytes)\n", path, fileSize)
	totalChunks := int((fileSize + chunkSize - 1) / chunkSize)

	// compute per-chunk hashes and overall hash (could be skipped for big files, but okay for MVP)
	chHashes := make([]string, totalChunks)
	fileHash, err := computeHashes(path, chHashes)
	if err != nil {
		return err
	}

	md := Metadata{
		UploadID:    uploadID,
		Filename:    filepath.Base(path),
		TotalChunks: totalChunks,
		ChunkSize:   chunkSize,
		ChunkHashes: chHashes,
		FileHash:    fileHash,
	}
	// init
	if err := initUpload(md); err != nil {
		return err
	}

	// query status (resume)
	received, err := queryStatus(uploadID)
	if err != nil {
		return err
	}
	receivedSet := make(map[int]bool)
	for _, idx := range received {
		receivedSet[idx] = true
	}
	// upload missing chunks concurrently
	jobs := make(chan int, totalChunks)
	var wg sync.WaitGroup
	for w := 0; w < maxWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				if receivedSet[idx] {
					continue
				}
				if err := uploadChunkWithRetry(uploadID, path, idx); err != nil {
					log.Printf("chunk %d failed: %v", idx, err)
				} else {
					log.Printf("uploaded chunk %d", idx)
				}
			}
		}()
	}
	for i := 0; i < totalChunks; i++ {
		if !receivedSet[i] {
			jobs <- i
		}
	}
	close(jobs)
	wg.Wait()

	// request completion
	if err := completeUpload(uploadID); err != nil {
		return err
	}
	log.Println("Upload complete.")
	return nil
}

func computeHashes(path string, chHashes []string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	hTotal := sha256.New()
	buf := make([]byte, chunkSize)
	i := 0
	for {
		n, err := io.ReadFull(f, buf)
		if err == io.ErrUnexpectedEOF || err == io.EOF {
			if n == 0 {
				break
			}
			data := buf[:n]
			h := sha256.Sum256(data)
			chHashes[i] = hex.EncodeToString(h[:])
			hTotal.Write(data)
			i++
			break
		} else if err != nil && err != io.ErrUnexpectedEOF {
			return "", err
		}
		data := buf[:n]
		h := sha256.Sum256(data)
		chHashes[i] = hex.EncodeToString(h[:])
		hTotal.Write(data)
		i++
	}
	return hex.EncodeToString(hTotal.Sum(nil)), nil
}

func initUpload(md Metadata) error {
	b, _ := json.Marshal(md)

	client := fiber.AcquireClient()
	defer fiber.ReleaseClient(client)

	agent := client.Post(serverBase + "/init")
	agent.Body(b)
	agent.ContentType("application/json")

	statusCode, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return errs[0]
	}
	if statusCode != 201 {
		return fmt.Errorf("init failed: %s", string(body))
	}
	return nil
}

func queryStatus(uploadID string) ([]int, error) {
	client := fiber.AcquireClient()
	defer fiber.ReleaseClient(client)

	agent := client.Get(serverBase + "/status/" + uploadID)

	statusCode, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return nil, errs[0]
	}
	if statusCode != 200 {
		return nil, fmt.Errorf("status query failed: %s", string(body))
	}

	var parsed struct {
		ReceivedChunks []int `json:"received_chunks"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	return parsed.ReceivedChunks, nil
}

func uploadChunkWithRetry(uploadID, path string, idx int) error {
	var lastErr error
	for attempt := 1; attempt <= retryLimit; attempt++ {
		if err := uploadChunk(uploadID, path, idx); err != nil {
			lastErr = err
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
			continue
		}
		return nil
	}
	return fmt.Errorf("after %d retries, last error: %v", retryLimit, lastErr)
}

func uploadChunk(uploadID, path string, idx int) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	offset := int64(idx) * chunkSize
	_, err = f.Seek(offset, io.SeekStart)
	if err != nil {
		return err
	}
	buf := make([]byte, chunkSize)
	n, err := io.ReadFull(f, buf)
	if err == io.ErrUnexpectedEOF || err == io.EOF {
		// last chunk with n < chunkSize
		buf = buf[:n]
	} else if err != nil && err != io.ErrUnexpectedEOF {
		return err
	}
	url := fmt.Sprintf("%s/upload/%s/%d", serverBase, uploadID, idx)

	// set content-type using file extension (nice to have)
	ctype := mime.TypeByExtension(filepath.Ext(path))
	if ctype == "" {
		ctype = "application/octet-stream"
	}

	client := fiber.AcquireClient()
	defer fiber.ReleaseClient(client)

	agent := client.Put(url)
	agent.Body(buf)
	agent.ContentType(ctype)
	agent.Timeout(60 * time.Second)

	statusCode, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return errs[0]
	}
	if statusCode != 200 {
		return fmt.Errorf("upload failed: %s", string(body))
	}
	return nil
}

func completeUpload(uploadID string) error {
	client := fiber.AcquireClient()
	defer fiber.ReleaseClient(client)

	agent := client.Post(serverBase + "/complete/" + uploadID)
	agent.Timeout(30 * time.Second)

	statusCode, body, errs := agent.Bytes()
	if len(errs) > 0 {
		return errs[0]
	}
	if statusCode != 200 {
		return fmt.Errorf("complete failed: %s", string(body))
	}

	var out map[string]interface{}
	_ = json.Unmarshal(body, &out)
	log.Printf("server complete response: %v\n", out)
	return nil
}
