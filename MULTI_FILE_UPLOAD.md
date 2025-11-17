# Multi-File Upload Feature

## Overview
AetherLink now supports uploading multiple files simultaneously with individual progress tracking, adaptive concurrency control, and intelligent retry mechanisms.

## Features

### ✅ Implemented

1. **Multiple File Selection**
   - Select multiple files at once via file picker
   - Drag and drop support for multiple files
   - Visual display of all selected files
   - Clear all files option

2. **Concurrent Upload Management**
   - Configurable max concurrent files (1-10, default: 3)
   - Files queued and uploaded sequentially up to the limit
   - Each file has independent upload session with unique `uploadID`

3. **Individual File Progress Tracking**
   - Real-time progress bar for each file
   - Chunk count display (uploaded/total)
   - Active worker count per file
   - Status indicators: pending, uploading, completed, failed, cancelled

4. **Adaptive Concurrency per File**
   - Each file upload uses adaptive worker pool (2-20 workers per file)
   - Dynamic chunk size based on network conditions
   - Independent retry logic with exponential backoff (up to 6 attempts)
   - Per-file timeout management

5. **Overall Progress Dashboard**
   - Aggregate progress across all files
   - Summary statistics: completed, failed, uploading, pending
   - Visual status breakdown with color-coded cards

6. **Flexible Control**
   - Cancel all uploads at once
   - Retry failed uploads automatically
   - Clear completed files from view
   - Adaptive network mode support

7. **Share ID Support**
   - Optional custom Share ID for all files
   - Each file gets unique Share ID if not specified
   - Room-based file grouping for collaboration

## Architecture

### Frontend Components

#### 1. `MultiFileUpload.tsx` (Main Component)
- Orchestrates entire multi-file upload flow
- Manages state and user interactions
- Integrates with adaptive network monitoring

#### 2. `MultiFileSelector.tsx`
- Handles file input with `multiple` attribute
- Displays selected files with size info
- Shows first 3 files inline for quick reference

#### 3. `MultiFileProgressList.tsx`
- Renders individual file cards with progress bars
- Status icons and color coding per file state
- Download links for completed files
- Share ID display per file

#### 4. `MultiFileOverview.tsx`
- Overall progress bar (average across all files)
- Status breakdown cards (completed, failed, uploading, pending)
- Total file count and summary stats

#### 5. `UploadModeToggle.tsx`
- Navigation between single and multi-file modes
- URL-based routing (`/sender` vs `/sender/multi`)

### Frontend Hooks

#### `useMultiFileUpload.ts`
Core logic for managing multiple file uploads:

```typescript
interface UseMultiFileUploadParams {
  maxConcurrentFiles?: number; // Max files uploading at once (default: 3)
  callbacks?: {
    onFileComplete?: (fileState: FileUploadState) => void;
    onFileError?: (fileState: FileUploadState, error: string) => void;
    onAllComplete?: (results: FileUploadState[]) => void;
    onProgressUpdate?: (state: MultiFileUploadState) => void;
  };
}
```

**Key Methods:**
- `startMultiUpload(files, profile, shareId)` - Start uploading multiple files
- `cancelAllUploads()` - Abort all active uploads
- `retryFailedUploads(profile)` - Retry failed files
- `clearCompleted()` - Remove completed files from view

**State Structure:**
```typescript
interface MultiFileUploadState {
  files: FileUploadState[];      // Array of file upload states
  isUploading: boolean;          // Any upload in progress
  completedCount: number;        // Successfully uploaded files
  failedCount: number;           // Failed uploads
  totalFiles: number;            // Total files in queue
  overallProgress: number;       // Average progress (0-100)
}

interface FileUploadState {
  file: File;                    // Original File object
  uploadId: string;              // Unique identifier
  shareId: string;               // Share ID for access control
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;              // 0-100
  uploadedChunks: number;
  totalChunks: number;
  metrics: UploadMetrics;
  downloadLink?: string;
  uploadTime?: string;
  costComparison?: CostComparison;
  error?: string;
  activeWorkers: number;
}
```

### Backend Support

The existing Go backend already supports multi-file uploads:

1. **Unique Upload IDs**: Each file gets `<filename>-<timestamp>-<index>`
2. **Concurrent Handling**: Fiber framework handles concurrent requests
3. **Isolated Storage**: Each upload stored in `./storage/<uploadID>/`
4. **SSE Broadcasting**: Real-time progress per upload ID
5. **Share ID Grouping**: Files can share same Share ID for room collaboration

No backend changes required - existing endpoints handle multiple concurrent uploads.

## Usage

### Basic Multi-File Upload

```typescript
// 1. Navigate to /sender/multi
// 2. Select multiple files via file picker
// 3. Optionally set custom Share ID
// 4. Click "Upload X Files" button
// 5. Monitor individual progress in real-time
```

### With Adaptive Network Mode

```typescript
// 1. Toggle "Adaptive Mode" ON
// 2. System auto-adjusts chunk size and workers per network quality
// 3. Each file independently adapts to current network conditions
```

### Advanced Settings

```typescript
// Max Concurrent Files: 1-10 (default: 3)
// - Lower value: More stable, less memory
// - Higher value: Faster total time (if bandwidth allows)

// Network Simulator: Test different network profiles
// - 2G, 3G, 4G, 5G simulations
// - Custom delay and failure rates
```

### Retry Failed Uploads

```typescript
// If any files fail:
// 1. "Retry Failed Uploads" button appears
// 2. Click to re-upload only failed files
// 3. Previous completed files remain unchanged
```

## API Reference

### `useMultiFileUpload` Hook

```typescript
const {
  state,                // MultiFileUploadState
  startMultiUpload,     // (files, profile, shareId?) => Promise<void>
  cancelAllUploads,     // () => void
  retryFailedUploads,   // (profile) => Promise<void>
  clearCompleted,       // () => void
} = useMultiFileUpload({
  maxConcurrentFiles: 3,
  callbacks: {
    onFileComplete: (fileState) => console.log('File done:', fileState.file.name),
    onFileError: (fileState, error) => console.error('File failed:', error),
    onAllComplete: (results) => console.log('All done!', results),
  }
});
```

### File Upload Flow

1. **Selection Phase**
   ```
   User selects files → Files added to state → Display in selector
   ```

2. **Upload Phase**
   ```
   startMultiUpload() called
   ├─ Initialize file states (pending)
   ├─ Create upload queue
   ├─ Start first N files (N = maxConcurrentFiles)
   ├─ For each file:
   │  ├─ Initialize session (/init)
   │  ├─ Check received chunks (/status)
   │  ├─ Upload missing chunks with retry (/upload)
   │  ├─ Complete upload (/complete)
   │  └─ Update state (completed/failed)
   └─ Continue with remaining files in queue
   ```

3. **Completion Phase**
   ```
   All files processed → isUploading = false → Show retry/clear buttons
   ```

## Performance Characteristics

### Memory Usage
- **Per File**: ~2-5MB (chunk buffers + state)
- **3 Concurrent Files**: ~6-15MB peak
- **10 Concurrent Files**: ~20-50MB peak

### Bandwidth Optimization
- Adaptive chunk size: 5KB (2G) to 20MB (5G+)
- Per-file worker pool: 2-20 workers
- Total concurrent chunks: up to 200 (10 files × 20 workers)

### Recommended Settings

| Network Type | Max Concurrent Files | Expected Throughput |
|--------------|---------------------|---------------------|
| 2G/3G        | 1-2                 | 50-200 KB/s         |
| 4G           | 3-5                 | 1-5 MB/s            |
| 5G/WiFi      | 5-10                | 10-50 MB/s          |

## Error Handling

### Individual File Failures
- Failed files marked with red status
- Error message displayed below filename
- Other files continue uploading
- Retry button available after completion

### Network Failures
- Automatic retry up to 6 attempts per chunk
- Exponential backoff: 400ms to 6s
- Adaptive concurrency reduces workers on errors

### Cancellation
- "Cancel All Uploads" aborts all active uploads
- Completed files remain available
- Partial uploads can be resumed (status endpoint)

## Future Enhancements

### Planned Features
- [ ] Pause/Resume individual files
- [ ] Drag-to-reorder upload queue
- [ ] Priority-based upload order
- [ ] Batch operations (select all, clear failed)
- [ ] Upload history persistence (localStorage)
- [ ] File deduplication (hash-based)
- [ ] Folder upload support
- [ ] Bandwidth throttling per file
- [ ] Upload speed graph per file

## Comparison: Single vs Multi-File

| Feature                  | Single File | Multi-File |
|-------------------------|-------------|------------|
| File Selection          | One at a time | Multiple at once |
| Concurrent Uploads      | N/A         | 1-10 configurable |
| Progress Tracking       | Single bar  | Per-file + overall |
| Retry Logic             | Manual      | Batch retry |
| Share ID Management     | One per upload | One for all or unique |
| Telemetry Dashboard     | Yes         | Per-file metrics |
| Memory Footprint        | ~2-5MB      | ~6-50MB (depending on concurrency) |
| Use Case                | Large single files | Batch document upload |

## Testing Checklist

- [x] Select 1 file → Upload successfully
- [x] Select 5 files → Upload concurrently (max 3 at once)
- [x] Cancel mid-upload → All files stop
- [x] Simulate network failure → Auto-retry works
- [x] Complete upload → Download links active
- [x] Retry failed files → Only failed files re-upload
- [x] Clear completed → UI resets properly
- [x] Adaptive mode → Chunk size adjusts
- [x] Custom Share ID → All files share same ID
- [x] Mode toggle → Switch between single/multi

## Code Diff Summary

### New Files Created
```
types/MultiFileUpload.ts              - Type definitions
hooks/useMultiFileUpload.ts           - Multi-file upload logic
components/MultiFileUpload.tsx        - Main multi-file component
components/upload/MultiFileSelector.tsx    - File selector
components/upload/MultiFileProgressList.tsx - Progress display
components/upload/MultiFileOverview.tsx    - Summary dashboard
components/upload/UploadModeToggle.tsx     - Single/Multi toggle
app/sender/multi/page.tsx             - Multi-file upload page
```

### Modified Files
```
components/FileUpload.tsx             + UploadModeToggle import/usage
components/upload/index.ts            + Export new components
```

### Backend Changes
```
None - Existing endpoints handle multiple concurrent uploads
```

## Deployment Notes

1. **Build Command**: `yarn build`
2. **Environment**: No new env vars required
3. **Backend**: Existing Go server handles multiple uploads
4. **Storage**: Ensure sufficient disk space (each file creates directory)
5. **Memory**: Adjust `maxConcurrentFiles` based on server RAM

## License
Same as AetherLink main project.
