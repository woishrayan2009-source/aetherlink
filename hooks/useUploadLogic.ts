import { bufferToHex, uploadChunk } from "@/utils/helpers/file";
import { UploadMetrics, CostComparison, COST_PER_MB, WASTED_MULTIPLIER } from "@/types/UploadMetrics";
import { NetworkProfile } from "@/types/NetworkProfile";
import { AdaptiveConcurrency } from "@/utils/AdaptiveConcurrency";
import xxhashWasm from "xxhash-wasm";

const DEFAULT_ENDPOINT = process.env.NEXT_PUBLIC_SERVER_URL!;

interface UploadLogicParams {
    isCancelling: boolean;
    setIsCompressing: (val: boolean) => void;
    setCompressionProgress: (val: number) => void;
    setIsUploading: (val: boolean) => void;
    setProgress: (val: number) => void;
    setUploadedChunks: (val: number) => void;
    setTotalChunks: (val: number) => void;
    setMetrics: React.Dispatch<React.SetStateAction<UploadMetrics>>;
    setUploadTime: (val: string) => void;
    setDownloadLink: (val: string) => void;
    setCostComparison: (val: CostComparison | null) => void;
    setShareId: (val: string) => void;
    setActiveWorkers: (val: number) => void;
    // Telemetry callbacks (optional for backward compatibility)
    onChunkStart?: (chunkId: string, index: number) => void;
    onChunkComplete?: (chunkId: string, index: number, durationMs: number, attempt: number) => void;
    onChunkError?: (chunkId: string, index: number, error: string, attempt: number) => void;
    onConcurrencyChange?: (newValue: number, oldValue: number, reason: string) => void;
    onNetworkDegradation?: (reason: string) => void;
    onNetworkRecovery?: (reason: string) => void;
}

export function useUploadLogic(params: UploadLogicParams) {
    const performUpload = async (
        file: File,
        startTime: number,
        currentProfile: NetworkProfile,
        customShareId?: string
    ) => {
        // CRITICAL: Lock in the chunk size at the START of upload
        // This prevents issues when adaptive mode changes the profile during upload
        const CHUNK_SIZE = currentProfile.chunkSize;
        const chunks = Math.ceil(file.size / CHUNK_SIZE);
        params.setTotalChunks(chunks);

        console.log(`🔒 Upload locked: CHUNK_SIZE=${CHUNK_SIZE}, CHUNKS=${chunks}, FILE_SIZE=${file.size}`);

        // Initialize adaptive concurrency manager
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
        adaptiveManager.reset();

        // Subscribe to adaptive events
        const unsubscribe = adaptiveManager.on((event) => {
            switch (event.type) {
                case 'concurrencyChanged':
                    console.log(`🔄 Workers: ${event.oldValue} → ${event.newValue} (${event.reason})`);
                    params.onConcurrencyChange?.(event.newValue, event.oldValue, event.reason);
                    break;
                case 'networkDegraded':
                    console.log('⚠️ Network degraded - reducing workers');
                    params.onNetworkDegradation?.('Network performance degraded');
                    break;
                case 'networkRecovered':
                    console.log('✅ Network recovered - optimizing workers');
                    params.onNetworkRecovery?.('Network performance recovered');
                    break;
            }
        });

        console.log(`🎯 Adaptive mode: min=4, max=40, initial=10`);

        // Initialize xxHash
        const hasher = await xxhashWasm();

        // Compute hashes on-demand during upload instead of upfront
        const computeChunkHash = async (chunkIndex: number): Promise<string> => {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const blob = file.slice(start, end);
            const ab = await blob.arrayBuffer();
            const hash = hasher.h64Raw(new Uint8Array(ab));
            return hash.toString(16).padStart(16, '0');
        };

        // Start upload immediately without computing file hash upfront
        // The server will verify chunks individually, and we'll compute file hash at the end
        const uploadID = `${file.name.replace(/[^a-z0-9.-_]/gi, "")}-${Date.now()}`;
        const metadata: any = {
            upload_id: uploadID,
            filename: file.name,
            total_chunks: chunks,
            chunk_size: CHUNK_SIZE,
            chunk_hashes: [], // Empty - server will validate per chunk if needed
            file_hash: '', // Will compute at completion if needed
        };
        
        // Include custom share_id if provided
        if (customShareId && customShareId.trim()) {
            metadata.share_id = customShareId.trim();
        }

        const initRes = await fetch(`${DEFAULT_ENDPOINT}/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metadata),
        });

        if (!initRes.ok) throw new Error(`init failed: ${initRes.status}`);
        
        const initData = await initRes.json() as { upload_id: string; share_id: string };
        const shareId = initData.share_id;

        const statusRes = await fetch(`${DEFAULT_ENDPOINT}/status/${uploadID}`);
        let received: number[] = [];
        if (statusRes.ok) {
            const parsed = await statusRes.json() as { received_chunks: number[] };
            received = parsed.received_chunks || [];
        }
        const receivedSet = new Set<number>(received);

        let uploadedCount = received.length;
        let totalRetries = 0;
        params.setUploadedChunks(uploadedCount);
        params.setProgress(Math.round((uploadedCount / chunks) * 100));

        const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
            if (params.isCancelling) {
                throw new Error('Upload cancelled by user');
            }

            // Use the LOCKED CHUNK_SIZE, not currentProfile.chunkSize
            // This ensures consistency throughout the upload
            const start = idx * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const blob = file.slice(start, end);

            // Record chunk start for adaptive concurrency
            const chunkId = `${uploadID}-${idx}`;
            adaptiveManager.recordChunkStart(chunkId);
            const chunkStartTime = performance.now();
            
            // Telemetry: Record chunk start
            params.onChunkStart?.(chunkId, idx);

            // Get dynamic timeout from adaptive manager
            const timeout = adaptiveManager.getTimeout();
            
            // Create abort controller for timeout
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
                abortController.abort();
            }, timeout);

            try {
                // Create a locked profile snapshot to prevent mid-upload changes
                const lockedProfile: NetworkProfile = {
                    ...currentProfile,
                    chunkSize: CHUNK_SIZE, // Use locked chunk size
                    workers: adaptiveManager.getConcurrency() // Use adaptive concurrency
                };
                
                // Race between upload and timeout
                await Promise.race([
                    uploadChunk(uploadID, idx, blob, lockedProfile, DEFAULT_ENDPOINT),
                    new Promise((_, reject) => {
                        abortController.signal.addEventListener('abort', () => {
                            reject(new Error(`Chunk ${idx} timed out after ${timeout}ms`));
                        });
                    })
                ]);
                
                clearTimeout(timeoutId);
                
                // Record success
                const chunkDuration = performance.now() - chunkStartTime;
                adaptiveManager.recordChunkSuccess(chunkId, chunkDuration, attempt - 1);
                
                // Telemetry: Record chunk completion
                params.onChunkComplete?.(chunkId, idx, chunkDuration, attempt);
                
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
                clearTimeout(timeoutId);
                
                // Record error
                const errorMessage = (err as Error).message || 'Unknown error';
                adaptiveManager.recordChunkError(
                    chunkId,
                    errorMessage,
                    attempt - 1
                );
                
                // Telemetry: Record chunk error
                params.onChunkError?.(chunkId, idx, errorMessage, attempt);
                
                if (params.isCancelling || (err as Error).message === 'Upload cancelled by user') {
                    throw err;
                }

                totalRetries++;
                params.setMetrics(prev => ({
                    ...prev,
                    failedRetries: totalRetries,
                    wastedBytes: prev.wastedBytes + blob.size
                }));

                // Retry logic with exponential backoff
                if (attempt < 6) {
                    const isTimeout = errorMessage.includes('timed out');
                    const backoffMs = isTimeout ? attempt * 1000 : attempt * 400;
                    
                    console.log(`⚠️ Chunk ${idx} failed (attempt ${attempt}): ${errorMessage}. Retrying in ${backoffMs}ms...`);
                    
                    await new Promise((r) => setTimeout(r, backoffMs));
                    return uploadWithRetry(idx, attempt + 1);
                }
                throw err;
            }
        };

        const chunksToUpload: number[] = [];
        for (let i = 0; i < chunks; i++) {
            if (!receivedSet.has(i)) chunksToUpload.push(i);
        }

        console.log(`📤 Uploading ${chunksToUpload.length} chunks (${received.length} already received)`);

        // Adaptive worker pool with strict concurrency control
        const activeUploads = new Map<number, Promise<void>>();
        const activeWorkerIndices = new Set<number>(); // Track which chunks are being processed
        let queueIndex = 0;
        let workerSpawnLock = false; // Prevent concurrent worker spawning

        const fillWorkerPool = async () => {
            // Prevent concurrent execution of fillWorkerPool (race condition guard)
            if (workerSpawnLock) {
                console.log('⚠️ Worker spawn blocked: already spawning workers');
                return;
            }
            
            workerSpawnLock = true;
            
            try {
                const maxConcurrent = adaptiveManager.getConcurrency();
                
                // CRITICAL: Defensive cleanup of zombie workers before spawning new ones
                // Remove any workers that are in the map but promise resolved (shouldn't happen, but defensive)
                for (const [idx, promise] of Array.from(activeUploads.entries())) {
                    await Promise.race([
                        promise.then(() => 'resolved'),
                        Promise.resolve('pending')
                    ]).then(status => {
                        if (status === 'resolved' && activeUploads.has(idx)) {
                            console.log(`🧹 Cleaned up zombie worker for chunk ${idx}`);
                            activeUploads.delete(idx);
                            activeWorkerIndices.delete(idx);
                        }
                    });
                }
                
                // Log worker pool state for debugging race conditions
                const currentWorkers = activeUploads.size;
                if (currentWorkers > maxConcurrent) {
                    console.error(`❌ RACE CONDITION DETECTED: ${currentWorkers} workers > ${maxConcurrent} max! Indices: ${Array.from(activeWorkerIndices).join(', ')}`);
                }

                // STRICT ENFORCEMENT: Only spawn workers if we're strictly below maxConcurrent
                while (activeUploads.size < maxConcurrent && queueIndex < chunksToUpload.length) {
                    // Double-check we're not at limit (defensive check)
                    if (activeUploads.size >= maxConcurrent) {
                        console.log(`⚠️ Worker spawn aborted: at maxWorkers (${maxConcurrent})`);
                        break;
                    }
                    
                    const idx = chunksToUpload[queueIndex++];
                    
                    // Prevent duplicate worker for same chunk (shouldn't happen, but defensive)
                    if (activeWorkerIndices.has(idx)) {
                        console.error(`❌ DUPLICATE WORKER PREVENTED: chunk ${idx} already being processed`);
                        continue;
                    }

                    // Mark worker as active BEFORE creating promise (prevent race)
                    activeWorkerIndices.add(idx);
                    activeUploads.set(idx, Promise.resolve()); // Placeholder to reserve slot
                    
                    // Log worker creation
                    console.log(`🚀 Spawning worker for chunk ${idx} (${activeUploads.size}/${maxConcurrent})`);

                    const uploadPromise = uploadWithRetry(idx)
                        .finally(() => {
                            // Defensive cleanup: ensure worker is removed from all tracking structures
                            const wasActive = activeUploads.has(idx);
                            const wasTracked = activeWorkerIndices.has(idx);
                            
                            activeUploads.delete(idx);
                            activeWorkerIndices.delete(idx);
                            
                            console.log(`✅ Worker cleanup for chunk ${idx} (wasActive: ${wasActive}, wasTracked: ${wasTracked}, remaining: ${activeUploads.size})`);
                            
                            // Update UI state AFTER worker pool state is updated
                            params.setActiveWorkers(activeUploads.size);
                            
                            // Detect stale references
                            if (!wasActive || !wasTracked) {
                                console.error(`❌ STALE WORKER REFERENCE: chunk ${idx} wasActive=${wasActive}, wasTracked=${wasTracked}`);
                            }
                        });

                    // Replace placeholder with actual promise
                    activeUploads.set(idx, uploadPromise);
                }
                
                // Update UI state AFTER all workers spawned
                params.setActiveWorkers(activeUploads.size);
                
            } finally {
                workerSpawnLock = false;
            }
        };

        // Main upload loop with adaptive concurrency
        while (queueIndex < chunksToUpload.length || activeUploads.size > 0) {
            await fillWorkerPool(); // Now async and awaited

            if (activeUploads.size > 0) {
                await Promise.race(Array.from(activeUploads.values()));
            }
        }

        // Final defensive cleanup
        if (activeUploads.size > 0 || activeWorkerIndices.size > 0) {
            console.error(`❌ WORKER LEAK DETECTED: ${activeUploads.size} uploads, ${activeWorkerIndices.size} indices remaining`);
            activeUploads.clear();
            activeWorkerIndices.clear();
        }
        
        params.setActiveWorkers(0);

        // Stop adaptive manager and log final metrics
        adaptiveManager.stop();
        unsubscribe();

        const finalMetrics = adaptiveManager.getMetrics();
        if (finalMetrics) {
            console.log('📊 Final metrics:', {
                avgTime: `${finalMetrics.averageUploadTime.toFixed(0)}ms`,
                success: `${finalMetrics.successRate.toFixed(1)}%`,
                throughput: `${finalMetrics.throughput.toFixed(2)} chunks/s`,
            });
        }

        const completeRes = await fetch(`${DEFAULT_ENDPOINT}/complete/${uploadID}`, { method: "POST" });
        if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`);

        console.log(`✅ Upload completed successfully: ${uploadID}`);

        const fileSizeMB = file.size / 1024 / 1024;
        const retryRate = totalRetries / chunks;
        const dynamicWastedMultiplier = Math.max(WASTED_MULTIPLIER, 1.0 + (retryRate * 5));

        const traditionalCost = fileSizeMB * COST_PER_MB * dynamicWastedMultiplier;
        const aetherLinkCost = fileSizeMB * COST_PER_MB;
        const savings = traditionalCost - aetherLinkCost;
        const savingsPercentage = (savings / traditionalCost) * 100;

        params.setCostComparison({
            traditionalCost,
            aetherLinkCost,
            savings,
            savingsPercentage,
            wastedMultiplier: dynamicWastedMultiplier
        });

        return { uploadID, shareId };
    };

    const startUpload = async (
        file: File,
        compressionSettings: any,
        currentProfile: NetworkProfile,
        customShareId?: string
    ) => {

        params.setIsUploading(true);
        params.setProgress(0);
        params.setUploadTime("");
        params.setUploadedChunks(0);
        params.setActiveWorkers(0);

        const fileToUpload = file;

        const startTime = performance.now();
        params.setMetrics(prev => ({ ...prev, startTime, totalBytes: fileToUpload.size }));

        try {
            const result = await performUpload(fileToUpload, startTime, currentProfile, customShareId);

            const endTime = performance.now();
            params.setUploadTime(((endTime - startTime) / 1000).toFixed(2) + "s");
            params.setDownloadLink(`${DEFAULT_ENDPOINT.replace(/\/$/, "")}/static/${result.uploadID}/${encodeURIComponent(fileToUpload.name)}`);
            params.setShareId(result.shareId);
            
            return result.shareId;
        } catch (err: any) {
            if (params.isCancelling || err?.message === 'Upload cancelled by user') {
                console.log('Upload cancelled by user');
            } else {
                alert("Upload failed: " + (err?.message || err));
            }
        } finally {
            params.setIsUploading(false);
        }
    };

    return { startUpload };
}
