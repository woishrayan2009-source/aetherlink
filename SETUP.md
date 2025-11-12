# Setup Instructions for Advanced Features

## 📦 Installation

### 1. Image Compression (Required)

Install the browser-image-compression library:

```bash
yarn add browser-image-compression
```

Or with npm:

```bash
npm install browser-image-compression
```

### 2. Video Compression (Optional - Advanced)

⚠️ **Note**: Video compression is CPU-intensive and requires ffmpeg.wasm. Only install if you need video compression capabilities.

```bash
yarn add @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg/util
```

Or with npm:

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg/util
```

#### SharedArrayBuffer Configuration (for video compression)

For ffmpeg.wasm to work, you need to enable SharedArrayBuffer by adding these headers to your Next.js configuration:

**next.config.ts**:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 🚀 Quick Start

After installation, the features are automatically available in the FileUpload component!

### Using Compression

1. Upload a file (image or video)
2. Toggle "Compress before upload"
3. Adjust quality slider (0-100)
4. Select compression level (Fast/Balanced/Maximum)
5. See estimated size savings
6. Click "Start Upload"

### Using Multi-Destination

1. Click "Add Destination"
2. Enter destination details:
   - Name: e.g., "AWS Backup"
   - Type: AWS S3 / Azure / GCP / Custom
   - Endpoint: Your server URL
3. Enable/disable destinations using toggle button
4. Upload - files go to all enabled destinations

---

## 🧪 Testing

### Test Image Compression

```bash
# 1. Start the development server
yarn dev

# 2. Open http://localhost:3000

# 3. Upload a large image (e.g., 10MB PNG)

# 4. Enable compression
   - Toggle "Compress before upload"
   - Set quality to 50
   - Choose "Maximum" compression
   
# 5. Expected result:
   - Estimated size: ~1-2 MB (80-90% smaller)
   - Compression time: 2-5 seconds
   - Upload time: Much faster
```

### Test Multi-Destination

```bash
# 1. Ensure your Go server is running
cd server/orchestrator
go run main.go

# 2. In the UI, add multiple destinations:
   - Destination 1: http://localhost:8080
   - Destination 2: http://localhost:8081 (if you have another server)
   - Destination 3: Custom endpoint

# 3. Enable desired destinations

# 4. Upload a file

# 5. Watch progress bars for each destination
```

---

## 🔍 Verify Installation

Run this command to check if dependencies are installed:

```bash
yarn list browser-image-compression
```

Expected output:
```
└─ browser-image-compression@2.x.x
```

For video compression (optional):
```bash
yarn list @ffmpeg/ffmpeg @ffmpeg/core
```

---

## ⚡ Performance Tips

### For Compression

- **Small files (<5MB)**: Use "Maximum" compression
- **Medium files (5-50MB)**: Use "Balanced" compression
- **Large files (>50MB)**: Use "Fast" compression
- **Images**: Quality 60-80 is usually optimal
- **Videos**: Quality 40-60 is usually optimal

### For Multi-Destination

- **Limit destinations**: 3-5 destinations max for best performance
- **Use parallel mode**: Enable parallel uploads in settings
- **Check network**: Ensure stable connection to all destinations
- **Test endpoints**: Verify all destinations are reachable before uploading

---

## 🐛 Common Issues

### Issue: "Cannot find module 'browser-image-compression'"

**Solution**:
```bash
# Clean install
rm -rf node_modules yarn.lock
yarn install
```

### Issue: "SharedArrayBuffer is not defined" (video compression)

**Solution**: Add CORS headers to next.config.ts (see above)

### Issue: "Compression failed"

**Possible causes**:
- File type not supported
- File too large (>500MB may fail)
- Insufficient browser memory

**Solution**:
- Try smaller files
- Use "Fast" compression level
- Reduce quality setting

### Issue: "Multi-destination upload fails"

**Possible causes**:
- Destination endpoint not reachable
- CORS not configured on server
- Network connectivity issues

**Solution**:
```bash
# Test endpoint manually
curl -X POST http://your-endpoint/init

# Check CORS headers
curl -I -X OPTIONS http://your-endpoint/init
```

---

## 📊 Monitoring

### Check Compression Metrics

Open browser console and look for:

```
Compressing image with options: {maxSizeMB: 1, maxWidthOrHeight: 1920, ...}
Compression complete: 10485760 → 2097152 bytes
```

### Check Upload Progress

Watch the console for:

```
Upload to AWS Backup: 45%
Upload to Azure Backup: 52%
Upload to Primary Server: 100% ✅
```

---

## 🎯 Next Steps

1. ✅ Install dependencies
2. ✅ Test compression with sample images
3. ✅ Test multi-destination with localhost
4. 📝 Configure production endpoints
5. 🚀 Deploy to production

---

## 📞 Support

If you encounter issues:

1. Check the browser console for errors
2. Review the [FEATURES.md](./FEATURES.md) documentation
3. Verify all dependencies are installed
4. Check network connectivity to destinations
5. Review server logs for API errors

---

## 🔗 Resources

- [AetherLink README](./README.md) - Main project documentation
- [FEATURES.md](./FEATURES.md) - Detailed feature documentation
- [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) - Image compression library
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) - Video compression library
- [Next.js Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers) - Configuration guide
