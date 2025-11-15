package main

import (
	"fmt"
	"log"
	"os"

	"aetherlink/config"
	"aetherlink/middleware"
	"aetherlink/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)

func main() {
	if os.Getenv("CLOUDINARY_CLOUD_NAME") == "" {
		err := godotenv.Load()
		if err != nil {
			log.Println("Error loading .env file")
		}
	}
	if err := os.MkdirAll(config.StorageRoot, 0755); err != nil {
		log.Fatal(err)
	}

	app := fiber.New(fiber.Config{
		BodyLimit: config.MaxUploadSize,
	})

	app.Use(middleware.SetupCORS())

	routes.SetupRoutes(app)

	log.Printf("Server listening on %s\n", config.ServerPort)
	log.Fatal(app.Listen(config.ServerPort))
}

func init() {
	fmt.Println("In")
}
