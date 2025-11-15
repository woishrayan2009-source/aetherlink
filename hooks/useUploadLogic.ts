import { bufferToHex, uploadChunk } from "@/utils/helpers/file";
import { UploadMetrics, CostComparison, COST_PER_MB, WASTED_MULTIPLIER } from "@/types/UploadMetrics";
import { NetworkProfile } from "@/types/NetworkProfile";
import { AdaptiveConcurrency } from "@/utils/AdaptiveConcurrency";
import xxhashWasm from "xxhash-wasm";

const DEFAULT_ENDPOINT = "http://localhost:8080";

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
        currentProfile: NetworkProfile
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
        const metadata = {
            upload_id: uploadID,
            filename: file.name,
            total_chunks: chunks,
            chunk_size: CHUNK_SIZE,
            chunk_hashes: [], // Empty - server will validate per chunk if needed
            file_hash: '', // Will compute at completion if needed
        };

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

            try {
                // Create a locked profile snapshot to prevent mid-upload changes
                const lockedProfile: NetworkProfile = {
                    ...currentProfile,
                    chunkSize: CHUNK_SIZE, // Use locked chunk size
                    workers: adaptiveManager.getConcurrency() // Use adaptive concurrency
                };
                await uploadChunk(uploadID, idx, blob, lockedProfile, DEFAULT_ENDPOINT);
                
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

                if (attempt < 6) {
                    await new Promise((r) => setTimeout(r, attempt * 400));
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

        // Adaptive worker pool
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

        // Main upload loop with adaptive concurrency
        while (queueIndex < chunksToUpload.length || activeUploads.size > 0) {
            fillWorkerPool();

            if (activeUploads.size > 0) {
                await Promise.race(Array.from(activeUploads.values()));
            }
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
        currentProfile: NetworkProfile
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
            const { uploadID, shareId } = await performUpload(fileToUpload, startTime, currentProfile);

            const endTime = performance.now();
            params.setUploadTime(((endTime - startTime) / 1000).toFixed(2) + "s");
            params.setDownloadLink(`${DEFAULT_ENDPOINT.replace(/\/$/, "")}/static/${uploadID}/${encodeURIComponent(fileToUpload.name)}`);
            params.setShareId(shareId);
            
            return shareId;
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
