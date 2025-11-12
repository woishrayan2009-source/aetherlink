# AetherLink Feature Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AETHERLINK FRONTEND                       │
│                     (Next.js + React + TypeScript)               │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FileUpload Component                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  State Management:                                        │  │
│  │  • file, priority, progress                               │  │
│  │  • compressionSettings                                    │  │
│  │  • destinations[]                                         │  │
│  │  • isCompressing, isUploading                             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ CompressionToggle│  │ MultiDestination│  │  Other Components│
│    Component    │  │    Component    │  │  (Network, etc.) │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Upload Flow                               │
│                                                                  │
│  1. User selects file                                           │
│  2. [Optional] Enable compression → compress file               │
│  3. Select/enable destinations                                  │
│  4. Click "Start Upload"                                        │
│  5. Upload to all enabled destinations in parallel              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗜️ Compression Feature Flow

```
┌─────────────┐
│ User Uploads│
│    File     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ CompressionToggle Component         │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Toggle: [OFF] → [ON]            ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Quality Slider: [0────●────100] ││
│ │ (0 = max compression)           ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Level: [Fast][Balanced][Max]    ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Estimate:                       ││
│ │ Original:   50 MB               ││
│ │ Compressed: 15 MB               ││
│ │ Savings:    35 MB (70%)         ││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ User clicks "Start Upload"          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Compression Process                 │
│                                     │
│ if (compressionEnabled) {           │
│   if (isImage) {                    │
│     → compressImage()               │
│       • browser-image-compression   │
│       • Convert to WebP             │
│       • Apply quality settings      │
│   }                                 │
│   else if (isVideo) {               │
│     → compressVideo()               │
│       • ffmpeg.wasm                 │
│       • Re-encode H.264             │
│       • Apply CRF settings          │
│   }                                 │
│ }                                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Compressed File Ready               │
│ (or original if compression failed) │
└──────┬──────────────────────────────┘
       │
       ▼
   [Continue to Upload]
```

---

## 🌍 Multi-Destination Feature Flow

```
┌─────────────────────────────────────┐
│ MultiDestination Component          │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Destinations List:              ││
│ │                                 ││
│ │ [✓] AWS S3                      ││
│ │     api.aws.com                 ││
│ │     Status: ⏳ 75%              ││
│ │                                 ││
│ │ [✓] Azure Blob                  ││
│ │     backup.azure.com            ││
│ │     Status: ⏳ 82%              ││
│ │                                 ││
│ │ [ ] Custom Server               ││
│ │     localhost:8080              ││
│ │     Status: ⏸️ Disabled         ││
│ │                                 ││
│ │ [+ Add Destination]             ││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Upload Process                      │
│                                     │
│ enabledDestinations = [             │
│   AWS S3,                           │
│   Azure Blob                        │
│ ]                                   │
│                                     │
│ Promise.all([                       │
│   uploadToDestination(file, AWS),   │
│   uploadToDestination(file, Azure)  │
│ ])                                  │
└──────┬─────────────────┬────────────┘
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  Upload to  │   │  Upload to  │
│   AWS S3    │   │ Azure Blob  │
│             │   │             │
│ Chunk 0 ✓   │   │ Chunk 0 ✓   │
│ Chunk 1 ✓   │   │ Chunk 1 ✓   │
│ Chunk 2 ⏳  │   │ Chunk 2 ✓   │
│ Chunk 3 ⏸️  │   │ Chunk 3 ⏳  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  Complete   │   │  Complete   │
│  Status: ✅ │   │  Status: ✅ │
└─────────────┘   └─────────────┘
```

---

## 🔄 Combined Feature Flow

```
┌────────────────┐
│  Select File   │
│   (50 MB)      │
└───────┬────────┘
        │
        ▼
┌───────────────────────────────┐
│ Enable Compression            │
│ Quality: 70                   │
│ Level: Balanced               │
│ Estimated: 15 MB (70% saving) │
└───────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Configure Destinations        │
│ [✓] AWS S3                    │
│ [✓] Azure Blob                │
│ [✓] GCP Storage               │
└───────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Click "Start Upload"          │
└───────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Step 1: Compress              │
│ 50 MB → 15 MB                 │
│ Time: ~5 seconds              │
└───────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Step 2: Parallel Upload       │
│                               │
│ ┌─────────┐ ┌─────────┐ ┌───┐│
│ │ AWS S3  │ │ Azure   │ │GCP││
│ │ 15 MB   │ │ 15 MB   │ │15M││
│ │ ⏳ 65%  │ │ ⏳ 72%  │ │⏳8││
│ └─────────┘ └─────────┘ └───┘│
└───────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Results:                      │
│                               │
│ Compression Savings:          │
│ • 35 MB bandwidth saved       │
│ • ~$3.15 cost saved           │
│                               │
│ Multi-Destination Benefits:   │
│ • 3 redundant copies          │
│ • Total transfer: 45 MB       │
│   (vs 150 MB without compress)│
│ • Total savings: 105 MB       │
│ • Cost savings: ~$9.45        │
│                               │
│ Status:                       │
│ AWS S3: ✅ Success            │
│ Azure:  ✅ Success            │
│ GCP:    ✅ Success            │
└───────────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser (Client Side)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Original File│                                               │
│  │   (50 MB)    │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────┐                                │
│  │ browser-image-compression   │                                │
│  │ or ffmpeg.wasm              │                                │
│  └──────┬──────────────────────┘                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │Compressed File│                                              │
│  │   (15 MB)    │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ├─────────────┬─────────────┬─────────────┐             │
│         ▼             ▼             ▼             ▼             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Chunk 0  │  │ Chunk 1  │  │ Chunk 2  │  │ Chunk 3  │        │
│  │ + SHA256 │  │ + SHA256 │  │ + SHA256 │  │ + SHA256 │        │
│  │ + Priority│  │ + Priority│  │ + Priority│  │ + Priority│       │
│  └──────┬───┘  └──────┬───┘  └──────┬───┘  └──────┬───┘        │
│         │             │             │             │             │
└─────────┼─────────────┼─────────────┼─────────────┼─────────────┘
          │             │             │             │
          ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Network Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  Parallel Upload to Multiple Destinations                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Destination│  │  Destination│  │  Destination│             │
│  │      1      │  │      2      │  │      3      │             │
│  │   AWS S3    │  │ Azure Blob  │  │ GCP Storage │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Server Endpoints                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /init          → Create upload session                    │
│  PUT /upload/:id/:i  → Upload chunk with priority               │
│  GET /status/:id     → Check upload progress                    │
│  POST /complete/:id  → Finalize upload                          │
│  GET /static/:id/:fn → Download file                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Component Hierarchy

```
App
└── FileUpload
    ├── ThemeToggle
    ├── UploadHeader
    ├── NetworkSelector
    ├── PrioritySelector
    ├── NetworkStatus
    ├── FileSelector
    ├── CompressionToggle ⭐ NEW
    │   ├── Toggle Switch
    │   ├── Quality Slider
    │   ├── Level Buttons [Fast|Balanced|Maximum]
    │   └── Size Estimate Display
    ├── MultiDestination ⭐ NEW
    │   ├── Destination List
    │   │   ├── Destination Card (AWS)
    │   │   ├── Destination Card (Azure)
    │   │   └── Destination Card (Custom)
    │   └── Add Destination Form
    ├── ParallelToggle
    ├── ProgressDisplay
    ├── SuccessMessage
    ├── CostComparison
    ├── ActivityPanel
    └── CancelConfirmDialog
```

---

## 💾 State Management

```typescript
FileUpload Component State:
├── file: File | null
├── priority: 'high' | 'medium' | 'low'
├── progress: number (0-100)
├── isUploading: boolean
├── isCancelling: boolean
├── parallel: boolean
├── downloadLink: string
├── uploadTime: string
├── metrics: UploadMetrics
├── costComparison: CostComparison | null
│
├── compressionSettings: CompressionSettings ⭐ NEW
│   ├── enabled: boolean
│   ├── quality: number (0-100)
│   ├── level: 'fast' | 'balanced' | 'maximum'
│   ├── estimatedSize: number
│   └── originalSize: number
│
├── isCompressing: boolean ⭐ NEW
├── compressionProgress: number ⭐ NEW
│
└── destinations: Destination[] ⭐ NEW
    └── Destination
        ├── id: string
        ├── name: string
        ├── type: 'aws' | 'azure' | 'gcp' | 'custom'
        ├── endpoint: string
        ├── enabled: boolean
        ├── status?: 'pending' | 'uploading' | 'success' | 'failed'
        └── progress?: number
```

---

## 🔌 API Interactions

```
Multi-Destination Upload API Flow:

For each enabled destination:

1. Initialize Upload
   POST /init
   Body: {
     upload_id,
     filename,
     total_chunks,
     chunk_size,
     chunk_hashes[],
     file_hash
   }
   Response: { status: "initialized" }

2. Check Status (Optional)
   GET /status/:uploadID
   Response: { received_chunks: [0, 2, 5] }

3. Upload Chunks (Parallel/Sequential)
   PUT /upload/:uploadID/:chunkIndex
   Headers: {
     Content-Type: application/octet-stream
     X-Priority: high|medium|low
   }
   Body: <chunk blob>
   Response: 200 OK

4. Complete Upload
   POST /complete/:uploadID
   Response: {
     status: "completed",
     download_url: "/static/..."
   }

5. Download (Optional)
   GET /static/:uploadID/:filename
   Response: <file blob>
```

---

## 🔄 Parallel vs Sequential Upload

```
Sequential Upload (parallel = false):
────────────────────────────────────
Chunk 0: [████████████] Done
Chunk 1:              [████████████] Done
Chunk 2:                           [████████████] Done
Chunk 3:                                        [████████████] Done

Total Time: 40 seconds


Parallel Upload (parallel = true, workers = 3):
─────────────────────────────────────────────────
Worker 1 - Chunk 0: [████████████] Done
Worker 2 - Chunk 1: [████████████] Done
Worker 3 - Chunk 2: [████████████] Done
Worker 1 - Chunk 3:              [████████████] Done

Total Time: 15 seconds (2.67x faster)
```

---

## 📈 Performance Metrics

```
┌─────────────────────────────────────────────────────────┐
│                  Upload Performance                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Without Compression:                                   │
│  ────────────────────                                   │
│  File Size: 50 MB                                       │
│  Upload Time: 45 seconds                                │
│  Bandwidth: 50 MB                                       │
│  Cost: $4.50                                            │
│                                                          │
│  With Compression (70% quality, Balanced):              │
│  ──────────────────────────────────────                 │
│  Original: 50 MB                                        │
│  Compressed: 15 MB (70% smaller)                        │
│  Compression Time: 5 seconds                            │
│  Upload Time: 13 seconds                                │
│  Total Time: 18 seconds                                 │
│  Bandwidth: 15 MB (70% saved)                           │
│  Cost: $1.35 (70% saved)                                │
│                                                          │
│  Multi-Destination (3 destinations):                    │
│  ────────────────────────────────────                   │
│  Without Compression:                                   │
│    3 × 50 MB = 150 MB                                   │
│    Cost: $13.50                                         │
│                                                          │
│  With Compression:                                      │
│    3 × 15 MB = 45 MB                                    │
│    Cost: $4.05                                          │
│    Savings: 105 MB, $9.45 (70%)                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

This visual architecture documentation helps understand how all the pieces fit together!
