package config

import (
	"context"
	"log"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

var Cloudinary *cloudinary.Cloudinary

func InitCloudinary() error {
	var err error
	Cloudinary, err = cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		log.Println("Failed to initialize Cloudinary:", err)
		return err
	}
	return nil
}

func InitCloudinaryAsService(cloudName, apiKey, apiSecret string) error {
	var err error
	Cloudinary, err = cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		log.Println("Failed to initialize Cloudinary:", err)
		return err
	}
	return nil
}

func UploadFileToCloudinary(filePath string) (string, error) {
	err := InitCloudinary()
	if err != nil {
		return "", err
	}
	uploadResult, err := Cloudinary.Upload.Upload(context.Background(), filePath, uploader.UploadParams{})
	if err != nil {
		log.Println("Failed to upload file to Cloudinary:", err)
		return "", err
	}
	return uploadResult.SecureURL, nil
}

func UploadFileToCloudinaryAsService(filepath string, cloudname string, apikey string, apisecret string) (string, error) {
	err := InitCloudinaryAsService(cloudname, apikey, apisecret)
	if err != nil {
		return "", err
	}
	uploadResult, err := Cloudinary.Upload.Upload(context.Background(), filepath, uploader.UploadParams{})
	if err != nil {
		log.Println("Failed to upload file to Cloudinary:", err)
		return "", err
	}
	return uploadResult.SecureURL, nil
}
