# Sender/Receiver Interface

This document describes the new sender/receiver interface system for AetherLink.

## Overview

AetherLink now has dedicated interfaces for senders and receivers, allowing for a clear separation of concerns and optimized workflows for each role.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Landing Page (/)                      │
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │   Sender Card    │         │  Receiver Card   │     │
│  │   (Upload)       │         │  (Download)      │     │
│  └──────────────────┘         └──────────────────┘     │
│         │                              │                │
│         ▼                              ▼                │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  /sender         │         │  /receiver       │     │
│  │  Upload files    │         │  Browse files    │     │
│  └──────────────────┘         └──────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Pages

### 1. Landing Page (`/`)
- **Purpose**: Role selection interface
- **Features**:
  - Beautiful animated cards for sender/receiver selection
  - Theme toggle (dark/light mode)
  - Feature highlights for each role
  - Smooth animations and hover effects

### 2. Sender Page (`/sender`)
- **Purpose**: File upload interface
- **Features**:
  - File selection and upload
  - Real-time progress tracking
  - Adaptive network monitoring
  - Chunk-based upload with retry logic
  - Compression support
  - Cost comparison analytics
  - Network status display

### 3. Receiver Page (`/receiver`)
- **Purpose**: File browsing and download interface
- **Features**:
  - Browse all available files
  - Search and sort functionality
  - Real-time file status updates
  - Download complete files
  - Stream files (when supported)
  - Progress indicators for incomplete uploads
  - Auto-refresh every 5 seconds
  - Detailed file information:
    - File size
    - Upload time
    - Chunk status
    - Completion percentage

## API Endpoints

### GET `/files`
Returns list of all available files.

**Response:**
```json
{
  "files": [
    {
      "upload_id": "example-file-123456789",
      "filename": "document.pdf",
      "total_chunks": 100,
      "received_chunks": 100,
      "file_size": 10485760,
      "upload_time": "2025-11-15T10:30:00Z",
      "status": "complete"
    }
  ],
  "count": 1
}
```

### GET `/static/:uploadID/:filename`
Download a completed file.

### GET `/stream/:uploadID/:filename`
Stream a file (for video/audio playback).

## User Flows

### Sender Flow
1. Land on home page
2. Click "Sender" card
3. Select file to upload
4. (Optional) Enable adaptive mode for automatic optimization
5. (Optional) Configure compression and network settings
6. Click "Upload File"
7. Monitor real-time progress
8. Receive download link upon completion
9. Share link with receiver

### Receiver Flow
1. Land on home page
2. Click "Receiver" card
3. Browse available files
4. Use search to find specific files
5. View file details and status
6. Download complete files
7. Stream media files directly

## Features

### Sender Features
✅ **Adaptive Network Monitoring**
- Real-time network speed detection
- Automatic chunk size optimization
- Dynamic worker allocation
- Zero performance impact

✅ **Robust Upload**
- Chunked uploads with retry logic
- Hash verification per chunk
- Resume capability
- Cancellation support

✅ **Compression**
- Optional file compression
- Quality settings
- Size estimation
- Fallback to original file

### Receiver Features
✅ **File Management**
- Browse all uploads
- Search by filename or ID
- Sort by date, name, or size
- Auto-refresh every 5 seconds

✅ **Download Options**
- Direct download
- Streaming support
- Progress indicators
- Status badges

✅ **Real-time Status**
- Complete/incomplete indicators
- Chunk progress bars
- File size display
- Upload timestamp

## UI/UX Highlights

### Design System
- **Dark/Light Mode**: Fully themed interface
- **Glassmorphism**: Backdrop blur effects
- **Smooth Animations**: Fade-in, slide-in, hover effects
- **Responsive**: Mobile-first design
- **Color Coding**:
  - Cyan/Blue for Sender
  - Purple/Pink for Receiver
  - Green for complete status
  - Yellow for incomplete status

### Accessibility
- Clear visual hierarchy
- High contrast ratios
- Keyboard navigation support
- Screen reader friendly
- Descriptive labels and titles

## Technical Implementation

### Frontend Stack
- **Next.js 14+**: App router with client components
- **React Hooks**: State management
- **Tailwind CSS**: Styling
- **TypeScript**: Type safety

### Backend Integration
- **Go Fiber**: HTTP server
- **REST API**: File operations
- **SSE**: Real-time updates
- **Local/S3 Storage**: Flexible storage backend

## Configuration

### Environment Variables
```env
NEXT_PUBLIC_SERVER_URL=http://localhost:8080
```

### Server Configuration
The server automatically handles:
- File listing via `/files` endpoint
- Static file serving via `/static/:uploadID/:filename`
- CORS for cross-origin requests
- File metadata management

## Future Enhancements

- [ ] Share links with expiry
- [ ] Password-protected downloads
- [ ] Batch downloads (ZIP)
- [ ] Upload history per user
- [ ] File preview (images, PDFs)
- [ ] Drag-and-drop uploads
- [ ] Progress persistence across sessions
- [ ] Transfer speed graph
- [ ] QR code for easy sharing
- [ ] Email notifications
- [ ] Mobile apps

## Testing

### Test Sender Flow
1. Navigate to `/sender`
2. Upload a test file
3. Verify progress updates
4. Check completion message
5. Verify download link works

### Test Receiver Flow
1. Navigate to `/receiver`
2. Verify file list loads
3. Test search functionality
4. Test sort options
5. Test download button
6. Verify status updates

## Troubleshooting

### Files Not Showing
- Check server is running
- Verify CORS settings
- Check storage directory permissions
- Verify `/files` endpoint is accessible

### Downloads Failing
- Check file completion status
- Verify static file serving is enabled
- Check storage path configuration
- Verify file exists on server

### UI Not Loading
- Clear browser cache
- Check console for errors
- Verify Next.js dev server is running
- Check for TypeScript errors

## Security Considerations

- No authentication yet (planned)
- Files are publicly accessible
- No upload size limits enforced on frontend
- CORS allows all origins (development)

For production:
- Add authentication/authorization
- Implement upload rate limiting
- Add virus scanning
- Enable HTTPS only
- Restrict CORS origins
- Add request signing

## License

Part of the AetherLink project.
