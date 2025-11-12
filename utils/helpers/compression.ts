/**
 * Compression utilities for client-side file compression
 * Supports images and videos with configurable quality settings
 */

export interface CompressionOptions {
  quality: number; // 0-100
  level: 'fast' | 'balanced' | 'maximum';
  maxWidthOrHeight?: number;
}

/**
 * Compress an image file using browser-image-compression library
 * Converts to WebP for better compression
 */
export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<File> {
  try {
    // Dynamic import to avoid SSR issues
    const imageCompression = (await import('browser-image-compression')).default;
    
    // Convert quality (0=max compression, 100=min compression) to compression settings
    const qualityFactor = options.quality / 100;
    
    // Determine max size based on compression level
    let maxSizeMB: number;
    if (options.level === 'maximum') {
      maxSizeMB = 0.5 + (qualityFactor * 1.5); // 0.5-2 MB
    } else if (options.level === 'balanced') {
      maxSizeMB = 1.0 + (qualityFactor * 2.0); // 1-3 MB
    } else { // fast
      maxSizeMB = 2.0 + (qualityFactor * 2.0); // 2-4 MB
    }

    // Determine max dimensions
    const maxWidthOrHeight = options.maxWidthOrHeight || (
      options.level === 'maximum' ? 1920 :
      options.level === 'balanced' ? 2560 :
      3840 // 4K for fast
    );

    const compressionOptions = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker: true,
      fileType: 'image/webp' as const,
      initialQuality: qualityFactor * 0.9 + 0.1 // 0.1 to 1.0
    };

    console.log('Compressing image with options:', compressionOptions);
    const compressedFile = await imageCompression(file, compressionOptions);
    
    // Rename to maintain original name but with .webp extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    return new File([compressedFile], `${nameWithoutExt}.webp`, {
      type: 'image/webp',
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Compress a video file using ffmpeg.wasm
 * Note: This is a heavy operation and requires ffmpeg.wasm to be installed
 * Uses the new @ffmpeg/ffmpeg v0.12+ API
 */
export async function compressVideo(
  file: File,
  options: CompressionOptions,
  onProgress?: (progress: number) => void
): Promise<File> {
  try {
    // Dynamic import to avoid SSR issues
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
    
    const ffmpeg = new FFmpeg();
    
    // Set up progress handler
    ffmpeg.on('progress', ({ progress, time }) => {
      if (onProgress) {
        onProgress(Math.round(progress * 100));
      }
    });

    // Set up log handler
    ffmpeg.on('log', ({ message }) => {
      console.log('[ffmpeg]', message);
    });

    console.log('Loading ffmpeg.wasm...');
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    console.log('ffmpeg.wasm loaded');

    // Convert quality to CRF (Constant Rate Factor)
    // CRF: 0 = lossless, 51 = worst quality
    // Quality slider: 0 (max compression) to 100 (min compression)
    const qualityFactor = options.quality / 100;
    let crf: number;
    
    if (options.level === 'maximum') {
      crf = Math.round(28 - (qualityFactor * 10)); // CRF 18-28
    } else if (options.level === 'balanced') {
      crf = Math.round(28 - (qualityFactor * 8)); // CRF 20-28
    } else { // fast
      crf = Math.round(28 - (qualityFactor * 5)); // CRF 23-28
    }

    // Determine preset (speed vs compression)
    const preset = options.level === 'maximum' ? 'slow' :
                   options.level === 'balanced' ? 'medium' :
                   'fast';

    const inputName = 'input' + getFileExtension(file.name);
    const outputName = 'output.mp4';

    console.log('Writing input file to ffmpeg filesystem...');
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    console.log(`Compressing video with CRF=${crf}, preset=${preset}...`);
    await ffmpeg.exec([
      '-i', inputName,
      '-vcodec', 'libx264',
      '-crf', crf.toString(),
      '-preset', preset,
      '-acodec', 'aac',
      '-b:a', '128k', // Audio bitrate
      outputName
    ]);

    console.log('Reading compressed video from ffmpeg filesystem...');
    const data = await ffmpeg.readFile(outputName);
    
    // Create output file - convert Uint8Array to standard ArrayBuffer
    const uint8Array = new Uint8Array(data as Uint8Array);
    const compressedFile = new File(
      [uint8Array],
      file.name.replace(/\.[^/.]+$/, '.mp4'),
      { type: 'video/mp4', lastModified: Date.now() }
    );

    console.log(`Video compressed: ${formatBytes(file.size)} → ${formatBytes(compressedFile.size)}`);
    return compressedFile;
  } catch (error) {
    console.error('Video compression failed:', error);
    throw new Error(`Video compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main compression function that routes to appropriate compression method
 */
export async function compressFile(
  file: File,
  options: CompressionOptions,
  onProgress?: (progress: number) => void
): Promise<File> {
  if (file.type.startsWith('image/')) {
    return compressImage(file, options);
  } else if (file.type.startsWith('video/')) {
    return compressVideo(file, options, onProgress);
  } else {
    // No compression for other file types
    console.log('File type not supported for compression:', file.type);
    return file;
  }
}

/**
 * Check if a file type is compressible
 */
export function isCompressible(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

/**
 * Get file extension including the dot
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[^/.]+$/);
  return match ? match[0] : '';
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
