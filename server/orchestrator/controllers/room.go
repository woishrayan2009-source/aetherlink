package controllers

import (
	"aetherlink/services"
	"bufio"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

// RoomHandler returns the current state of a room
func RoomHandler(c *fiber.Ctx) error {
	shareID := c.Params("shareId")
	if shareID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "share_id is required",
		})
	}

	state, err := services.Room.GetRoomState(shareID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch room state",
		})
	}

	return c.JSON(state)
}

// RoomSSEHandler handles Server-Sent Events for room-level broadcasts
func RoomSSEHandler(c *fiber.Ctx) error {
	shareID := c.Params("shareId")
	if shareID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "share_id is required",
		})
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	ch := make(chan string, 10)
	done := make(chan struct{})

	services.Room.AddRoomClient(shareID, ch)

	// Send initial room state
	go func() {
		time.Sleep(10 * time.Millisecond)
		services.Room.NotifyRoomStateUpdate(shareID)
	}()

	// Keep connection open and send messages
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		// Cleanup on disconnect
		defer func() {
			services.Room.RemoveRoomClient(shareID, ch)
			// Don't close the channel here - let it be garbage collected
			// close(ch)
		}()

		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}
				// Write as SSE "data: <json>\n\n"
				fmt.Fprintf(w, "data: %s\n\n", msg)
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				// Send keepalive comment
				fmt.Fprintf(w, ": keepalive\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			case <-done:
				// Connection closed
				return
			}
		}
	})

	return nil
}
