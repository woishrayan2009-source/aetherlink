package config

const (
	StorageRoot   = "./storage"
	MaxUploadSize = 1 << 30 // 1GB per request limit
	ServerPort    = ":8080"
)

// want to upload file on s3 or any cloud service