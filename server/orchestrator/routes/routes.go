package routes

import (
	"aetherlink/config"
	"aetherlink/controllers"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	app.Get("/health", controllers.HealthHandler)

	// Upload endpoints
	app.Post("/init", controllers.InitHandler)
	app.Put("/upload/:uploadID/:idx", controllers.UploadHandler)
	app.Get("/status/:uploadID", controllers.StatusHandler)
	app.Post("/complete/:uploadID", controllers.CompleteHandler)

	// SSE endpoint for real-time progress
	app.Get("/events/:uploadID", controllers.SSEHandler)

	// Static file serving for downloads
	app.Static("/static", config.StorageRoot)
}
