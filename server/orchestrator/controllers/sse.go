package controllers

import (
	"bufio"
	"fmt"
	"time"

	"aetherlink/config"
	"aetherlink/services"

	"github.com/gofiber/fiber/v2"
)

// SSEHandler handles Server-Sent Events for real-time progress updates
func SSEHandler(c *fiber.Ctx) error {
	uploadID := c.Params("uploadID")

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	ch := make(chan string, 10)
	done := make(chan struct{})

	services.SSE.AddClient(uploadID, ch)

	// send initial progress once
	go func() {
		time.Sleep(10 * time.Millisecond)
		services.SSE.BroadcastProgress(uploadID, config.StorageRoot)
	}()

	// keep connection open and send messages
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		// cleanup on disconnect
		defer func() {
			close(done)
			services.SSE.RemoveClient(uploadID, ch)
			close(ch)
		}()

		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}
				// write as SSE "data: <json>\n\n"
				fmt.Fprintf(w, "data: %s\n\n", msg)
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				// send keepalive comment
				fmt.Fprintf(w, ": keepalive\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			case <-done:
				// connection closed
				return
			}
		}
	})

	return nil
}
