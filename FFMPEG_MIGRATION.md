# 🔄 FFmpeg.wasm Migration Guide

## API Change Notice

If you encounter the error **"createFFmpeg is not a function"**, it's because `@ffmpeg/ffmpeg` has been updated to v0.12+, which uses a completely different API.

## ✅ Fixed!

The AetherLink codebase has been updated to use the new API. Here's what changed:

---

## Old API (v0.11 and earlier)

```typescript
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({
  log: true,
  progress: ({ ratio }) => {
    console.log(`Progress: ${ratio * 100}%`);
  }
});

await ffmpeg.load();

ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));
await ffmpeg.run('-i', 'input.mp4', '-vcodec', 'h264', 'output.mp4');
const data = ffmpeg.FS('readFile', 'output.mp4');

const outputFile = new File([data.buffer], 'output.mp4');
```

---

## New API (v0.12+) ✅

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

// Set up event handlers
ffmpeg.on('progress', ({ progress, time }) => {
  console.log(`Progress: ${progress * 100}%`);
});

ffmpeg.on('log', ({ message }) => {
  console.log('[ffmpeg]', message);
});

// Load with explicit URLs
const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
await ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
});

await ffmpeg.writeFile('input.mp4', await fetchFile(file));
await ffmpeg.exec(['-i', 'input.mp4', '-vcodec', 'h264', 'output.mp4']);
const data = await ffmpeg.readFile('output.mp4');

const outputFile = new File([new Uint8Array(data)], 'output.mp4');
```

---

## Key Differences

### 1. Import Changes
```typescript
// OLD
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

// NEW
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
```

### 2. Initialization
```typescript
// OLD
const ffmpeg = createFFmpeg({ log: true, progress: handler });

// NEW
const ffmpeg = new FFmpeg();
ffmpeg.on('log', logHandler);
ffmpeg.on('progress', progressHandler);
```

### 3. Loading
```typescript
// OLD
await ffmpeg.load();

// NEW
await ffmpeg.load({
  coreURL: await toBlobURL('...ffmpeg-core.js', 'text/javascript'),
  wasmURL: await toBlobURL('...ffmpeg-core.wasm', 'application/wasm'),
});
```

### 4. File System Operations
```typescript
// OLD
ffmpeg.FS('writeFile', 'input.mp4', data);
const output = ffmpeg.FS('readFile', 'output.mp4');

// NEW
await ffmpeg.writeFile('input.mp4', data);
const output = await ffmpeg.readFile('output.mp4');
```

### 5. Running Commands
```typescript
// OLD
await ffmpeg.run('-i', 'input.mp4', '-vcodec', 'h264', 'output.mp4');

// NEW
await ffmpeg.exec(['-i', 'input.mp4', '-vcodec', 'h264', 'output.mp4']);
```

### 6. Data Handling
```typescript
// OLD
const file = new File([data.buffer], 'output.mp4');

// NEW
const file = new File([new Uint8Array(data)], 'output.mp4');
```

---

## Installation

### Required Packages
```bash
# Install all required packages
yarn add @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg/util

# Or with npm
npm install @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg/util
```

### Package Versions
- `@ffmpeg/ffmpeg`: ^0.12.x
- `@ffmpeg/core`: ^0.12.x
- `@ffmpeg/util`: ^0.12.x

---

## Configuration

### Next.js Headers (Required)

For ffmpeg.wasm to work, you need to enable SharedArrayBuffer:

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

## Testing

### Test Video Compression

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const testCompression = async (file: File) => {
  const ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[ffmpeg]', message);
  });
  
  ffmpeg.on('progress', ({ progress }) => {
    console.log(`Progress: ${Math.round(progress * 100)}%`);
  });
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  await ffmpeg.writeFile('input.mp4', await fetchFile(file));
  
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vcodec', 'libx264',
    '-crf', '28',
    '-preset', 'fast',
    '-acodec', 'aac',
    'output.mp4'
  ]);
  
  const data = await ffmpeg.readFile('output.mp4');
  const compressed = new File([new Uint8Array(data)], 'compressed.mp4', {
    type: 'video/mp4'
  });
  
  console.log('Original:', file.size, 'bytes');
  console.log('Compressed:', compressed.size, 'bytes');
  console.log('Savings:', Math.round((1 - compressed.size / file.size) * 100) + '%');
  
  return compressed;
};
```

---

## Common Errors

### Error: "createFFmpeg is not a function"
**Solution**: Update to the new API (already done in AetherLink)

### Error: "SharedArrayBuffer is not defined"
**Solution**: Add CORS headers to next.config.ts (see Configuration above)

### Error: "Cannot find module '@ffmpeg/util'"
**Solution**: Install the util package:
```bash
yarn add @ffmpeg/util
```

### Error: "Failed to load ffmpeg-core"
**Solution**: Check your internet connection and CDN URL. The files are loaded from unpkg.com

---

## Performance Tips

1. **Load Once**: Create the FFmpeg instance once and reuse it
2. **Progress Tracking**: Use the progress event for UI updates
3. **Error Handling**: Always wrap in try-catch blocks
4. **Memory Management**: Clean up files after processing

---

## Resources

- [FFmpeg.wasm Official Docs](https://ffmpegwasm.netlify.app/)
- [Migration Guide](https://ffmpegwasm.netlify.app/docs/migration)
- [GitHub Repository](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [NPM Package](https://www.npmjs.com/package/@ffmpeg/ffmpeg)

---

## Status in AetherLink

✅ **Fixed and Updated**

The compression utility (`utils/helpers/compression.ts`) has been updated to use the new API. No further action needed!

- ✅ Updated imports
- ✅ New FFmpeg initialization
- ✅ Event handlers configured
- ✅ File operations updated
- ✅ Exec method implemented
- ✅ Data conversion fixed
- ✅ All packages installed

**You're good to go!** 🎉
