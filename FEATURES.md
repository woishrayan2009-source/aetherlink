# AetherLink Advanced Features

## 🗜️ Feature 11: Pre-Upload Compression

### Overview
Client-side file compression that reduces file sizes before uploading, saving bandwidth and improving upload times. Compression happens entirely in the browser using Web Workers to avoid UI blocking.

### Supported File Types

#### Images (Fully Implemented)
- **Formats**: JPEG, PNG, GIF, BMP, WebP
- **Output**: Converts to WebP for maximum compression efficiency
- **Compression Range**: 15%-70% of original size
- **Quality Settings**: 
  - Quality slider (0-100): 0 = maximum compression, 100 = minimum compression
  - Compression levels: Fast, Balanced, Maximum

#### Videos (Optional - Requires ffmpeg.wasm)
- **Formats**: MP4, MOV, AVI, MKV
- **Output**: Re-encodes to H.264 (MP4)
- **Compression Range**: 20%-80% of original size
- **Settings**:
  - CRF (Constant Rate Factor): 18-28
  - Presets: fast, medium, slow
  - Audio: AAC 128k

### How It Works

1. **User selects a file**
2. **Toggle compression** using the checkbox near file input
3. **Adjust quality settings**:
   - Move quality slider (affects output size)
   - Choose compression level (affects speed)
4. **See estimated size** before uploading
5. **Click "Start Upload"** - file is compressed first, then uploaded

### Configuration

```typescript
interface CompressionSettings {
  enabled: boolean;
  quality: number;      // 0-100
  level: 'fast' | 'balanced' | 'maximum';
  estimatedSize: number;
  originalSize: number;
}
```

### Installation

For **image compression only** (already working):
```bash
yarn add browser-image-compression
```

For **video compression** (optional):
```bash
yarn add @ffmpeg/ffmpeg @ffmpeg/core
```

### Benefits

- **Bandwidth Savings**: Reduce data transfer costs by 30-85%
- **Faster Uploads**: Smaller files = faster upload times
- **Client-Side**: No server resources needed
- **Preserves Quality**: Configurable quality settings
- **Real-time Estimates**: See savings before uploading

### Technical Implementation

**Image Compression** (`utils/helpers/compression.ts`):
```typescript
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1-4,           // Based on level
  maxWidthOrHeight: 1920-3840,  // Based on level
  useWebWorker: true,        // Non-blocking
  fileType: 'image/webp',    // Optimal format
  initialQuality: 0.1-1.0    // Based on slider
};

const compressed = await imageCompression(file, options);
```

**Video Compression** (optional):
```typescript
import { createFFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({ 
  log: true,
  progress: ({ ratio }) => updateProgress(ratio * 100)
});

await ffmpeg.load();
await ffmpeg.run(
  '-i', 'input.mp4',
  '-vcodec', 'libx264',
  '-crf', '18-28',
  '-preset', 'fast|medium|slow',
  '-acodec', 'aac',
  '-b:a', '128k',
  'output.mp4'
);
```

---

## 🌍 Feature 12: Multi-Destination Upload

### Overview
Upload files to multiple cloud providers or servers simultaneously. Perfect for redundancy, backup strategies, and multi-region deployments.

### Supported Providers

1. **AWS S3** - Amazon Web Services
2. **Azure Blob** - Microsoft Azure
3. **Google Cloud Storage** - GCP
4. **Custom Servers** - Any HTTP/HTTPS endpoint

### How It Works

1. **Add destinations** using the "Add Destination" button
2. **Configure each destination**:
   - Name (e.g., "Production Backup")
   - Provider type
   - Endpoint URL
3. **Enable/disable** destinations with toggle button
4. **Upload** - files are sent to all enabled destinations **in parallel**
5. **Track progress** for each destination independently

### Configuration

```typescript
interface Destination {
  id: string;
  name: string;
  type: 'aws' | 'azure' | 'gcp' | 'custom';
  endpoint: string;
  enabled: boolean;
  status?: 'pending' | 'uploading' | 'success' | 'failed';
  progress?: number;  // 0-100
}
```

### Benefits

- **Redundancy**: Multiple copies in different locations
- **Disaster Recovery**: Automatic backup to secondary servers
- **Multi-Region**: Upload to multiple geographic regions
- **Parallel Processing**: All uploads happen simultaneously
- **Independent Tracking**: See progress/status for each destination
- **Flexible**: Mix cloud providers and custom servers

### Usage Example

```typescript
const destinations: Destination[] = [
  {
    id: '1',
    name: 'Primary AWS',
    type: 'aws',
    endpoint: 'https://api.production.com/upload',
    enabled: true,
    status: 'pending'
  },
  {
    id: '2',
    name: 'Azure Backup',
    type: 'azure',
    endpoint: 'https://backup.azure.com/upload',
    enabled: true,
    status: 'pending'
  },
  {
    id: '3',
    name: 'Local Dev',
    type: 'custom',
    endpoint: 'http://localhost:8080',
    enabled: false,  // Disabled - won't upload
    status: 'pending'
  }
];
```

### API Requirements

Each destination endpoint must implement:

1. **POST /init** - Initialize upload session
2. **PUT /upload/:id/:chunk** - Upload chunk
3. **POST /complete/:id** - Finalize upload
4. **GET /status/:id** - Check upload status

### Technical Implementation

**Upload Flow**:
```typescript
// Filter enabled destinations
const enabled = destinations.filter(d => d.enabled);

// Upload to all destinations in parallel
await Promise.all(
  enabled.map(dest => uploadToDestination(file, dest))
);

// Track individual progress
setDestinations(prev => prev.map(d => 
  d.id === dest.id 
    ? { ...d, status: 'uploading', progress: percent }
    : d
));
```

### Error Handling

- **Independent Failures**: If one destination fails, others continue
- **Retry Logic**: Each destination has independent retry mechanism
- **Status Tracking**: Visual indicators (✅ success, ❌ failed, ⏳ uploading)
- **User Notification**: Clear error messages per destination

---

## 🚀 Combined Features

### Compression + Multi-Destination

When both features are enabled:

1. File is **compressed once** on the client
2. Compressed file is **uploaded to all destinations**
3. Benefits:
   - Save bandwidth on ALL uploads
   - Reduce total upload time
   - Lower costs across all providers

### Performance Example

**Without Compression**:
- Original file: 50 MB
- 3 destinations × 50 MB = **150 MB total transfer**
- Upload time: ~60 seconds (slow network)

**With Compression** (60% compression):
- Original file: 50 MB
- Compressed: 20 MB
- 3 destinations × 20 MB = **60 MB total transfer**
- Upload time: ~24 seconds
- **Savings**: 90 MB bandwidth, 36 seconds time, ~$8.10 cost

---

## 📊 Usage Statistics

Track compression and multi-destination metrics:

```typescript
interface UploadMetrics {
  // Compression metrics
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  
  // Multi-destination metrics
  destinationCount: number;
  successfulDestinations: number;
  failedDestinations: number;
  totalBandwidthSaved: number;
}
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Primary upload endpoint
NEXT_PUBLIC_SERVER_URL=http://localhost:8080

# Optional: Enable ffmpeg for video compression
NEXT_PUBLIC_ENABLE_VIDEO_COMPRESSION=true
```

### Component Props

```typescript
<FileUpload 
  // Compression settings
  defaultCompressionEnabled={false}
  defaultQuality={70}
  defaultLevel="balanced"
  
  // Multi-destination settings
  destinations={initialDestinations}
  allowCustomDestinations={true}
  maxDestinations={5}
/>
```

---

## 📝 Notes

### Browser Compatibility

- **Image Compression**: All modern browsers (Chrome 76+, Firefox 68+, Safari 13+)
- **Video Compression**: Requires SharedArrayBuffer (may need specific headers)
- **Web Workers**: Required for non-blocking compression

### CORS Requirements

For multi-destination uploads to external servers:

```typescript
// Server must allow CORS
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, PUT, GET
Access-Control-Allow-Headers: Content-Type, X-Priority
```

### Performance Tips

1. **Compression**:
   - Use "Fast" for large files (>100MB)
   - Use "Maximum" for small files (<10MB)
   - Adjust quality based on use case (70 is good default)

2. **Multi-Destination**:
   - Limit to 3-5 destinations for optimal performance
   - Use parallel mode for better throughput
   - Monitor network bandwidth usage

---

## 🐛 Troubleshooting

### Compression Issues

**Error: "Compression failed"**
- Check file type is supported (image/video)
- Try lower quality setting
- Ensure enough browser memory

**Video compression not working**
- Install `@ffmpeg/ffmpeg` and `@ffmpeg/core`
- Check SharedArrayBuffer is enabled
- Verify ffmpeg.wasm is loading correctly

### Multi-Destination Issues

**Error: "No destinations enabled"**
- Enable at least one destination
- Check destination endpoint is reachable
- Verify CORS headers on server

**Some destinations fail**
- Check individual endpoint URLs
- Verify server is running
- Check network connectivity
- Review server logs for errors

---

## 📚 API Reference

### Compression Functions

```typescript
// Main compression function
compressFile(file: File, options: CompressionOptions): Promise<File>

// Image-specific compression
compressImage(file: File, options: CompressionOptions): Promise<File>

// Video-specific compression (optional)
compressVideo(file: File, options: CompressionOptions, onProgress?: (p: number) => void): Promise<File>

// Check if file is compressible
isCompressible(file: File): boolean
```

### Multi-Destination Functions

```typescript
// Upload to single destination
uploadToDestination(file: File, destination: Destination, startTime: number): Promise<void>

// Update destination status
setDestinations(updater: (prev: Destination[]) => Destination[]): void

// Add new destination
addDestination(destination: Destination): void

// Remove destination
removeDestination(id: string): void

// Toggle destination
toggleDestination(id: string): void
```

---

## 🎯 Roadmap

### Planned Enhancements

- [ ] **Compression Presets**: Quick presets (Web, Mobile, Archive)
- [ ] **Format Options**: Allow choosing output format (WebP, JPEG, PNG)
- [ ] **Batch Compression**: Compress multiple files at once
- [ ] **Destination Templates**: Save/load destination configurations
- [ ] **Priority Uploads**: Upload to high-priority destinations first
- [ ] **Bandwidth Limiting**: Throttle upload speed per destination
- [ ] **Resume Support**: Resume failed uploads to specific destinations
- [ ] **Comparison Mode**: Compare compressed vs original before upload

---

## 📖 Learn More

- [browser-image-compression docs](https://github.com/Donaldcwl/browser-image-compression)
- [ffmpeg.wasm docs](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [WebP format](https://developers.google.com/speed/webp)
- [H.264 encoding](https://trac.ffmpeg.org/wiki/Encode/H.264)
