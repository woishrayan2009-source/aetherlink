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

	app.Get("/events/:uploadID", controllers.SSEHandler)

	app.Static("/static", config.StorageRoot)
}
