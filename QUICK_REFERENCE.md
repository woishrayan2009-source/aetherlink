# 🚀 Quick Reference Guide

## Installation

```bash
# Required for image compression
yarn add browser-image-compression

# Optional for video compression
yarn add @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg/util
```

## Usage

### Enable Compression
1. Upload file
2. Toggle "Compress before upload" ✅
3. Adjust quality slider (0-100)
4. Select level: Fast | Balanced | Maximum
5. See estimated savings
6. Click "Start Upload"

### Add Destinations
1. Click "Add Destination" ➕
2. Enter name, type, endpoint
3. Click "Add Destination" ✅
4. Enable/disable with toggle
5. Upload to all enabled destinations

## Key Settings

### Compression Quality
- **0-30**: Maximum compression (smaller files, lower quality)
- **40-70**: Balanced (recommended)
- **70-100**: Minimum compression (larger files, higher quality)

### Compression Level
- **Fast**: Quick compression (40-70% original size)
- **Balanced**: Medium speed (25-60% original size) ⭐ Recommended
- **Maximum**: Slow but best compression (15-50% original size)

## File Support

### Compression
- ✅ Images: JPEG, PNG, WebP, GIF, BMP
- ⏳ Videos: MP4, MOV, AVI (requires ffmpeg.wasm)
- ❌ Others: No compression

### Upload
- ✅ All file types supported
- ✅ Chunked upload (5KB - 10MB chunks)
- ✅ SHA-256 verification
- ✅ Auto-retry on failure

## Performance Tips

### For Best Compression
- Images < 10MB: Use "Maximum"
- Images 10-50MB: Use "Balanced"
- Images > 50MB: Use "Fast"
- Quality 60-80: Sweet spot for most images

### For Fastest Upload
- Enable compression (reduces transfer time)
- Use parallel mode
- Limit destinations to 3-5
- Choose nearby servers

## Cost Savings

### Example: 50MB Image
```
Without Compression:
- Upload: 50 MB
- Cost: $4.50
- Time: 45s

With Compression (Quality 70, Balanced):
- Compress: 5s
- Upload: 15 MB (70% smaller)
- Cost: $1.35 (70% saved)
- Time: 18s total
- Savings: $3.15 + 27 seconds
```

### Multi-Destination (3 servers)
```
Without Compression:
- Total: 150 MB
- Cost: $13.50

With Compression:
- Total: 45 MB
- Cost: $4.05
- Savings: 105 MB, $9.45
```

## Troubleshooting

### "Cannot find module 'browser-image-compression'"
```bash
rm -rf node_modules yarn.lock
yarn install
```

### "Compression failed"
- Try lower quality
- Use "Fast" level
- Check file size (< 500MB)

### "Multi-destination upload fails"
- Check endpoint URLs
- Verify CORS headers on server
- Test endpoints manually:
  ```bash
  curl -X POST http://endpoint/init
  ```

## Keyboard Shortcuts

- `Ctrl/Cmd + Click`: Upload without compression
- `Shift + Click`: Upload to all destinations

## API Endpoints

Each destination must support:
```
POST   /init                 # Initialize upload
PUT    /upload/:id/:chunk    # Upload chunk
POST   /complete/:id         # Finalize upload
GET    /status/:id           # Check status
GET    /static/:id/:filename # Download file
```

## Environment Variables

```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:8080
NEXT_PUBLIC_ENABLE_VIDEO_COMPRESSION=true
```

## Component Props

### CompressionToggle
```typescript
<CompressionToggle
  file={file}
  settings={compressionSettings}
  onSettingsChange={setCompressionSettings}
  isDark={isDark}
  isUploading={isUploading}
/>
```

### MultiDestination
```typescript
<MultiDestination
  destinations={destinations}
  onDestinationsChange={setDestinations}
  isDark={isDark}
  isUploading={isUploading}
/>
```

## State Interfaces

```typescript
interface CompressionSettings {
  enabled: boolean;
  quality: number;      // 0-100
  level: 'fast' | 'balanced' | 'maximum';
  estimatedSize: number;
  originalSize: number;
}

interface Destination {
  id: string;
  name: string;
  type: 'aws' | 'azure' | 'gcp' | 'custom';
  endpoint: string;
  enabled: boolean;
  status?: 'pending' | 'uploading' | 'success' | 'failed';
  progress?: number;
}
```

## Helper Functions

```typescript
// Compress file
import { compressFile, isCompressible } from '@/utils/helpers/compression';

if (isCompressible(file)) {
  const compressed = await compressFile(file, {
    quality: 70,
    level: 'balanced'
  });
}

// Upload to destination
import { uploadChunk } from '@/utils/helpers/file';

await uploadChunk(
  uploadID,
  chunkIndex,
  blob,
  priority,
  networkProfile,
  endpoint  // optional
);
```

## Testing

### Test Compression
1. Upload large image (10MB+)
2. Enable compression
3. Set quality to 50
4. Level: Maximum
5. Check estimated size
6. Upload and verify

### Test Multi-Destination
1. Add 2-3 destinations
2. Enable all
3. Upload file
4. Watch progress per destination
5. Verify all show ✅ success

## Documentation

- **README.md** - Main project docs
- **FEATURES.md** - Detailed feature guide
- **SETUP.md** - Installation guide
- **ARCHITECTURE.md** - System diagrams
- **IMPLEMENTATION_SUMMARY.md** - Implementation details

## Support

Questions? Check:
1. Browser console (F12)
2. Network tab (inspect requests)
3. Server logs
4. Documentation files

## Limits

- Max file size: 500 MB (compression)
- Max destinations: 10 (recommended: 3-5)
- Max chunk size: 10 MB
- Max workers: 4 (parallel mode)

## Browser Support

- ✅ Chrome 76+
- ✅ Firefox 68+
- ✅ Safari 13+
- ✅ Edge 79+

## Feature Status

- ✅ Image compression (ready)
- ⏳ Video compression (requires ffmpeg.wasm)
- ✅ Multi-destination (ready)
- ✅ Progress tracking (ready)
- ✅ Cost comparison (ready)
- ✅ Dark/light theme (ready)

---

**Quick Links:**
- [Full Features Guide](./FEATURES.md)
- [Setup Instructions](./SETUP.md)
- [Architecture Diagrams](./ARCHITECTURE.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

**Made with ❤️ for AetherLink**
