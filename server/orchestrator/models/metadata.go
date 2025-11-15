package models

type Metadata struct {
	UploadID    string   `json:"upload_id"`
	Filename    string   `json:"filename"`
	TotalChunks int      `json:"total_chunks"`
	ChunkSize   int64    `json:"chunk_size"`
	ChunkHashes []string `json:"chunk_hashes"` // client-provided expected hashes
	FileHash    string   `json:"file_hash"`    // overall file hash
	ShareID     string   `json:"share_id"`     // unique share ID for access control
}
