/**
 * ADAPTIVE CONCURRENCY INTEGRATION GUIDE
 * 
 * This guide shows how to integrate AdaptiveConcurrency into useUploadLogic.ts
 * 
 * KEY CHANGES NEEDED:
 * 
 * 1. Import AdaptiveConcurrency at the top of useUploadLogic.ts:
 *    import { AdaptiveConcurrency } from '@/utils/AdaptiveConcurrency';
 * 
 * 2. Create the adaptive manager (add at start of useUploadLogic function):
 *    const adaptiveManager = useRef<AdaptiveConcurrency | null>(null);
 * 
 * 3. Replace the fixed batch loop with adaptive worker pool (see below)
 * 
 * 4. Add metrics tracking to uploadWithRetry function (see below)
 * 
 * 5. Start/stop the manager appropriately (see below)
 */

// ============================================================================
// STEP 1: Initialize Adaptive Manager (add at start of performUpload)
// ============================================================================

// Add this AFTER locking CHUNK_SIZE and MAX_WORKERS:
/*
const adaptiveManager = new AdaptiveConcurrency({
    min: 4,
    max: 40,
    initial: 10,
    increaseStep: 2,
    decreaseStep: 4,
    evaluationInterval: 1500,
    performanceThreshold: 15,
    degradationThreshold: 20,
    errorRateThreshold: 10,
    stabilityWindow: 3,
});

adaptiveManager.start();

// Subscribe to events (optional but helpful for debugging)
const unsubscribe = adaptiveManager.on((event) => {
    switch (event.type) {
        case 'concurrencyChanged':
            console.log(`🔄 Workers: ${event.oldValue} → ${event.newValue} (${event.reason})`);
            break;
        case 'networkDegraded':
            console.log('⚠️ Network degraded');
            break;
        case 'networkRecovered':
            console.log('✅ Network recovered');
            break;
    }
});
*/

// ============================================================================
// STEP 2: Modify uploadWithRetry to Record Metrics
// ============================================================================

// REPLACE your existing uploadWithRetry function with this version:
/*
const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
    if (params.isCancelling) {
        throw new Error('Upload cancelled by user');
    }

    const start = idx * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    
    // ===== ADD THIS: Record chunk start =====
    const chunkId = `${uploadID}-${idx}`;
    adaptiveManager.recordChunkStart(chunkId);
    const chunkStartTime = performance.now();

    try {
        const lockedProfile: NetworkProfile = {
            ...currentProfile,
            chunkSize: CHUNK_SIZE,
            workers: adaptiveManager.getConcurrency() // ===== CHANGE: Use adaptive concurrency =====
        };
        
        await uploadChunk(uploadID, idx, blob, lockedProfile, DEFAULT_ENDPOINT);
        
        // ===== ADD THIS: Calculate duration =====
        const chunkDuration = performance.now() - chunkStartTime;
        
        // ===== ADD THIS: Record success =====
        adaptiveManager.recordChunkSuccess(chunkId, chunkDuration, attempt - 1);
        
        uploadedCount++;
        params.setUploadedChunks(uploadedCount);
        const progressPct = Math.round((uploadedCount / chunks) * 100);
        params.setProgress(progressPct);

        params.setMetrics(prev => ({
            ...prev,
            successfulChunks: uploadedCount,
            bandwidth: (file.size / ((performance.now() - startTime) / 1000)) / 1024 / 1024
        }));
        
    } catch (err) {
        // ===== ADD THIS: Record error =====
        adaptiveManager.recordChunkError(
            chunkId,
            (err as Error).message || 'Unknown error',
            attempt - 1
        );
        
        if (params.isCancelling || (err as Error).message === 'Upload cancelled by user') {
            throw err;
        }

        totalRetries++;
        params.setMetrics(prev => ({
            ...prev,
            failedRetries: totalRetries,
            wastedBytes: prev.wastedBytes + blob.size
        }));

        if (attempt < 6) {
            await new Promise((r) => setTimeout(r, attempt * 400));
            return uploadWithRetry(idx, attempt + 1);
        }
        throw err;
    }
};
*/

// ============================================================================
// STEP 3: Replace Fixed Batch Loop with Adaptive Worker Pool
// ============================================================================

// REPLACE this code:
//   for (let i = 0; i < chunksToUpload.length; i += MAX_WORKERS) {
//       const batch = chunksToUpload.slice(i, i + MAX_WORKERS);
//       params.setActiveWorkers(batch.length);
//       await Promise.all(batch.map((idx) => uploadWithRetry(idx)));
//   }
//   params.setActiveWorkers(0);

// WITH this adaptive worker pool:
/*
const activeUploads = new Map<number, Promise<void>>();
let queueIndex = 0;

const fillWorkerPool = () => {
    const maxConcurrent = adaptiveManager.getConcurrency();
    
    while (activeUploads.size < maxConcurrent && queueIndex < chunksToUpload.length) {
        const idx = chunksToUpload[queueIndex++];
        
        const uploadPromise = uploadWithRetry(idx)
            .finally(() => {
                activeUploads.delete(idx);
                params.setActiveWorkers(activeUploads.size);
            });
        
        activeUploads.set(idx, uploadPromise);
    }
    
    params.setActiveWorkers(activeUploads.size);
};

// Main upload loop
while (queueIndex < chunksToUpload.length || activeUploads.size > 0) {
    fillWorkerPool();
    
    if (activeUploads.size > 0) {
        await Promise.race(Array.from(activeUploads.values()));
    }
}

params.setActiveWorkers(0);
*/

// ============================================================================
// STEP 4: Cleanup (add at end of performUpload, before return)
// ============================================================================

/*
// Stop adaptive manager
adaptiveManager.stop();
unsubscribe(); // If you added event listener

// Optional: Log final metrics
const finalMetrics = adaptiveManager.getMetrics();
if (finalMetrics) {
    console.log('📊 Final metrics:', {
        avgTime: `${finalMetrics.averageUploadTime.toFixed(0)}ms`,
        success: `${finalMetrics.successRate.toFixed(1)}%`,
        throughput: `${finalMetrics.throughput.toFixed(2)} chunks/s`,
    });
}
*/

// ============================================================================
// SUMMARY OF CHANGES
// ============================================================================

/**
 * What gets changed:
 * 1. ✅ Create AdaptiveConcurrency instance at start of performUpload
 * 2. ✅ Start the manager and subscribe to events
 * 3. ✅ Replace MAX_WORKERS with adaptiveManager.getConcurrency()
 * 4. ✅ Add recordChunkStart() before each upload attempt
 * 5. ✅ Add recordChunkSuccess() after successful upload
 * 6. ✅ Add recordChunkError() in catch block
 * 7. ✅ Replace fixed batch loop with adaptive worker pool
 * 8. ✅ Stop manager and unsubscribe at end
 * 
 * What stays the same:
 * ✅ Chunk size calculation (still locked at start)
 * ✅ Compression logic
 * ✅ Retry logic with exponential backoff
 * ✅ Progress tracking and UI updates
 * ✅ Cost calculation
 * ✅ Error handling
 * ✅ Resume capability
 * ✅ SSE progress broadcasting
 * ✅ xxHash integrity verification
 */

export {}; // Make this a module
