import { bufferToHex, uploadChunk } from "@/utils/helpers/file";
import { compressFile, isCompressible as checkCompressible } from "@/utils/helpers/compression";
import { Priority, UploadMetrics, CostComparison, COST_PER_MB, WASTED_MULTIPLIER } from "@/types/UploadMetrics";
import { NetworkProfile } from "@/types/NetworkProfile";

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
}

export function useUploadLogic(params: UploadLogicParams) {
    const performUpload = async (
        file: File,
        startTime: number,
        priority: Priority,
        currentProfile: NetworkProfile
    ) => {
        const CHUNK_SIZE = currentProfile.chunkSize;
        const MAX_WORKERS = currentProfile.workers;
        const chunks = Math.ceil(file.size / CHUNK_SIZE);
        params.setTotalChunks(chunks);

        const chunkHashes: string[] = new Array(chunks);
        for (let i = 0; i < chunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const blob = file.slice(start, end);
            const ab = await blob.arrayBuffer();
            const digest = await crypto.subtle.digest("SHA-256", ab);
            chunkHashes[i] = bufferToHex(digest);
        }

        const whole = await file.arrayBuffer();
        const overallDigest = await crypto.subtle.digest("SHA-256", whole);
        const fileHash = bufferToHex(overallDigest);

        const uploadID = `${file.name.replace(/[^a-z0-9.-_]/gi, "")}-${Date.now()}`;
        const metadata = {
            upload_id: uploadID,
            filename: file.name,
            total_chunks: chunks,
            chunk_size: CHUNK_SIZE,
            chunk_hashes: chunkHashes,
            file_hash: fileHash,
        };

        const initRes = await fetch(`${DEFAULT_ENDPOINT}/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metadata),
        });

        if (!initRes.ok) throw new Error(`init failed: ${initRes.status}`);

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

            const start = idx * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const blob = file.slice(start, end);
            const chunkPriority = priority;

            try {
                await uploadChunk(uploadID, idx, blob, chunkPriority, currentProfile, DEFAULT_ENDPOINT);
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

        if (currentProfile.workers > 1) {
            for (let i = 0; i < chunksToUpload.length; i += MAX_WORKERS) {
                const batch = chunksToUpload.slice(i, i + MAX_WORKERS);
                await Promise.all(batch.map((idx) => uploadWithRetry(idx)));
            }
        } else {
            for (const idx of chunksToUpload) {
                await uploadWithRetry(idx);
            }
        }

        const completeRes = await fetch(`${DEFAULT_ENDPOINT}/complete/${uploadID}`, { method: "POST" });
        if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`);

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

        return uploadID;
    };

    const startUpload = async (
        file: File,
        priority: Priority,
        compressionSettings: any,
        currentProfile: NetworkProfile
    ) => {

        params.setIsUploading(true);
        params.setProgress(0);
        params.setUploadTime("");
        params.setUploadedChunks(0);
        localStorage.setItem('upload-priority', priority);

        let fileToUpload = file;
        if (compressionSettings.enabled && checkCompressible(file)) {
            try {
                params.setIsCompressing(true);
                fileToUpload = await compressFile(
                    file,
                    {
                        quality: compressionSettings.quality,
                        level: compressionSettings.level
                    },
                    (progress) => {
                        params.setCompressionProgress(progress);
                    }
                );
                params.setIsCompressing(false);
                params.setCompressionProgress(0);
            } catch (error) {
                console.error('Compression failed:', error);
                params.setIsCompressing(false);
                const shouldContinue = confirm(
                    `Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nDo you want to upload the original file instead?`
                );
                if (!shouldContinue) {
                    params.setIsUploading(false);
                    return;
                }
            }
        }

        const startTime = performance.now();
        params.setMetrics(prev => ({ ...prev, startTime, totalBytes: fileToUpload.size }));

        try {
            const uploadID = await performUpload(fileToUpload, startTime, priority, currentProfile);

            const endTime = performance.now();
            params.setUploadTime(((endTime - startTime) / 1000).toFixed(2) + "s");
            params.setDownloadLink(`${DEFAULT_ENDPOINT.replace(/\/$/, "")}/static/${uploadID}/${encodeURIComponent(fileToUpload.name)}`);
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
