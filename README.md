# AetherLink

**Resilient file transfer system with chunked uploads, resume capability, integrity verification, and real-time progress tracking.**

## What This Is

A distributed file transfer platform that chunks files for reliable uploads with automatic resume, hash-based integrity checks, and live progress updates via Server-Sent Events.

## Tech Stack

### Frontend (Next.js 16)
- **Framework**: React 19, TypeScript 5, Next.js 16
- **Styling**: Tailwind CSS 4, Lucide React icons
- **Features**: Drag-drop file upload, progress bars, parallel chunk uploads
- **Security**: SHA-256 client-side hashing (per-chunk + full file)
- **Real-time**: SSE for live progress updates
- **Persistence**: localStorage for resumable sessions

### Backend (Go - Orchestrator)
- **Framework**: Fiber v2 (REST + SSE)
- **Storage**: File-based chunked storage in `./storage/<uploadID>/`
- **Endpoints**:
  - `POST /init` - Initialize upload session
  - `PUT /upload/:uploadID/:idx` - Upload chunk with hash validation
  - `GET /status/:uploadID` - Query received chunks (resume support)
  - `POST /complete/:uploadID` - Reassemble & verify file
  - `GET /events/:uploadID` - SSE progress stream
  - `GET /static` - Download assembled files
- **Security**: Per-chunk SHA-256 validation, final file hash verification
- **Metadata**: Hash tracking (`.sha256`)

### Go Client (CLI)
- **Purpose**: Command-line bulk uploader
- **Config**: 5KB chunks, 4 parallel workers, 5 retry attempts
- **Features**: Resume from interruption, exponential backoff

## Features

- ✅ **Chunked Upload**: 1MB chunks (configurable)
- ✅ **Resume Support**: Query received chunks, skip completed ones
- ✅ **Integrity Checks**: SHA-256 validation per chunk + full file
- ✅ **Parallel Upload**: Multi-worker chunk upload for faster transfers
- ✅ **Real-time Progress**: SSE broadcast to all clients
- ✅ **Auto-reassembly**: Server stitches chunks on `/complete`
- ✅ **Retry Logic**: Exponential backoff (up to 6 attempts)
- ✅ **CORS Enabled**: Configured for `localhost:3000`

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │◄───SSE──┤ Orchestrator │◄────────┤  CLI Client │
│  (Next.js)  │────────►│   (Fiber)    │         │    (Go)     │
└─────────────┘  REST   └──────────────┘         └─────────────┘
     │                         │
     │                         ▼
     │                  ┌─────────────┐
     └─────────────────►│   Storage   │
          Download      │  (chunks)   │
                        └─────────────┘
```

## Current State

- ✅ Fully functional upload/download system
- ✅ Multiple completed upload sessions in storage
- ✅ Test files successfully transferred (25+ chunks processed)
- ✅ Real-time progress tracking operational
- ✅ Resume capability tested and working
