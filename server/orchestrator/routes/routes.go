package routes

import (
	"aetherlink/config"
	"aetherlink/controllers"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	app.Get("/health", controllers.HealthHandler)

	app.Post("/init", controllers.InitHandler)
	app.Put("/upload/:uploadID/:idx", controllers.UploadHandler)
	app.Get("/status/:uploadID", controllers.StatusHandler)
	app.Post("/complete/:uploadID", controllers.CompleteHandler)

	app.Delete("/cleanup/:uploadID", controllers.CleanupHandler)

	// File listing and info endpoints (require share_id)
	app.Get("/files", controllers.FilesHandler)
	app.Get("/file/:uploadID", controllers.FileInfoHandler)

	// Secure download endpoint (requires share_id)
	app.Get("/download/:uploadID/:filename", controllers.SecureDownloadHandler)

	// Room endpoints for multi-user support
	app.Get("/room/:shareId", controllers.RoomHandler)
	app.Get("/room/:shareId/events", controllers.RoomSSEHandler)

	app.Get("/events/:uploadID", controllers.SSEHandler)

	// Public static files (legacy - consider deprecating for security)
	app.Static("/static", config.StorageRoot)
}
