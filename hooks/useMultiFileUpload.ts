import { useState, useCallback, useRef } from 'react';
import { FileUploadState, MultiFileUploadState, MultiFileUploadCallbacks } from '@/types/MultiFileUpload';
import { UploadMetrics, CostComparison, COST_PER_MB, WASTED_MULTIPLIER } from '@/types/UploadMetrics';
import { NetworkProfile } from '@/types/NetworkProfile';
import { bufferToHex, uploadChunk } from '@/utils/helpers/file';
import { AdaptiveConcurrency } from '@/utils/AdaptiveConcurrency';
import xxhashWasm from 'xxhash-wasm';

const DEFAULT_ENDPOINT = process.env.NEXT_PUBLIC_SERVER_URL!;

interface UseMultiFileUploadParams {
  maxConcurrentFiles?: number; // Maximum files uploading at once
  callbacks?: MultiFileUploadCallbacks;
}

export function useMultiFileUpload(params: UseMultiFileUploadParams = {}) {
  const { maxConcurrentFiles = 3, callbacks } = params;
  
  const [state, setState] = useState<MultiFileUploadState>({
    files: [],
    isUploading: false,
    completedCount: 0,
    failedCount: 0,
    totalFiles: 0,
    overallProgress: 0,
  });

  const isCancellingRef = useRef(false);
  const activeUploadsRef = useRef<Map<string, AbortController>>(new Map());

  // Update individual file state
  const updateFileState = useCallback((uploadId: string, updates: Partial<FileUploadState>) => {
    setState(prev => {
      const files = prev.files.map(f => 
        f.uploadId === uploadId ? { ...f, ...updates } : f
      );

      // Calculate overall progress
      const totalProgress = files.reduce((sum, f) => sum + f.progress, 0);
      const overallProgress = files.length > 0 ? Math.round(totalProgress / files.length) : 0;

      const completedCount = files.filter(f => f.status === 'completed').length;
      const failedCount = files.filter(f => f.status === 'failed').length;

      const newState = {
        ...prev,
        files,
        overallProgress,
        completedCount,
        failedCount,
      };

      callbacks?.onProgressUpdate?.(newState);
      return newState;
    });
  }, [callbacks]);

  // Upload single file (reuses logic from useUploadLogic)
  const uploadSingleFile = async (
    fileState: FileUploadState,
    currentProfile: NetworkProfile,
    customShareId?: string
  ): Promise<void> => {
    const { file, uploadId } = fileState;
    const abortController = new AbortController();
    activeUploadsRef.current.set(uploadId, abortController);

    try {
      // Lock chunk size at start
      const CHUNK_SIZE = currentProfile.chunkSize;
      const chunks = Math.ceil(file.size / CHUNK_SIZE);

      updateFileState(uploadId, {
        totalChunks: chunks,
        status: 'uploading',
        startTime: performance.now(),
      });

      // Initialize adaptive concurrency
      const adaptiveManager = new AdaptiveConcurrency({
        min: 2,
        max: Math.min(currentProfile.workers, 20), // Limit per-file concurrency
        initial: 6,
        increaseStep: 2,
        decreaseStep: 3,
        evaluationInterval: 1500,
        performanceThreshold: 15,
        degradationThreshold: 20,
        errorRateThreshold: 10,
        stabilityWindow: 3,
      });

      adaptiveManager.start();

      // Initialize xxHash
      const hasher = await xxhashWasm();

      // Initialize upload session
      const metadata: any = {
        upload_id: uploadId,
        filename: file.name,
        total_chunks: chunks,
        chunk_size: CHUNK_SIZE,
        chunk_hashes: [],
        file_hash: '',
      };

      if (customShareId && customShareId.trim()) {
        metadata.share_id = customShareId.trim();
      }

      const initRes = await fetch(`${DEFAULT_ENDPOINT}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
        signal: abortController.signal,
      });

      if (!initRes.ok) {
        const errorData = await initRes.json().catch(() => ({}));
        const errorMsg = errorData.error || `Init failed: ${initRes.status}`;
        throw new Error(errorMsg);
      }


      const initData = await initRes.json() as { upload_id: string; share_id: string };
      const shareId = initData.share_id;

      updateFileState(uploadId, { shareId });

      // Check for already uploaded chunks
      const statusRes = await fetch(`${DEFAULT_ENDPOINT}/status/${uploadId}`, {
        signal: abortController.signal,
      });
      let received: number[] = [];
      if (statusRes.ok) {
        const parsed = await statusRes.json() as { received_chunks: number[] };
        received = parsed.received_chunks || [];
      }
      const receivedSet = new Set<number>(received);

      let uploadedCount = received.length;
      let totalRetries = 0;
      let wastedBytes = 0;

      updateFileState(uploadId, {
        uploadedChunks: uploadedCount,
        progress: Math.round((uploadedCount / chunks) * 100),
      });

      // Upload with retry logic
      const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
        if (isCancellingRef.current) {
          throw new Error('Upload cancelled by user');
        }

        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);

        const chunkId = `${uploadId}-${idx}`;
        adaptiveManager.recordChunkStart(chunkId);
        const chunkStartTime = performance.now();

        const timeout = adaptiveManager.getTimeout();
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

        try {
          const lockedProfile: NetworkProfile = {
            ...currentProfile,
            chunkSize: CHUNK_SIZE,
            workers: adaptiveManager.getConcurrency(),
          };

          await Promise.race([
            uploadChunk(uploadId, idx, blob, lockedProfile, DEFAULT_ENDPOINT),
            new Promise((_, reject) => {
              timeoutController.signal.addEventListener('abort', () => {
                reject(new Error(`Chunk ${idx} timed out after ${timeout}ms`));
              });
            }),
          ]);

          clearTimeout(timeoutId);

          const chunkDuration = performance.now() - chunkStartTime;
          adaptiveManager.recordChunkSuccess(chunkId, chunkDuration, attempt - 1);

          uploadedCount++;
          const progressPct = Math.round((uploadedCount / chunks) * 100);
          
          updateFileState(uploadId, {
            uploadedChunks: uploadedCount,
            progress: progressPct,
            activeWorkers: adaptiveManager.getConcurrency(),
            metrics: {
              ...fileState.metrics,
              successfulChunks: uploadedCount,
              bandwidth: (file.size / ((performance.now() - fileState.startTime!) / 1000)) / 1024 / 1024,
            },
          });

        } catch (err) {
          clearTimeout(timeoutId);

          const errorMessage = (err as Error).message || 'Unknown error';
          adaptiveManager.recordChunkError(chunkId, errorMessage, attempt - 1);

          if (isCancellingRef.current || errorMessage === 'Upload cancelled by user') {
            throw err;
          }

          totalRetries++;
          wastedBytes += blob.size;

          if (attempt < 6) {
            const isTimeout = errorMessage.includes('timed out');
            const backoffMs = isTimeout ? attempt * 1000 : attempt * 400;
            await new Promise(r => setTimeout(r, backoffMs));
            return uploadWithRetry(idx, attempt + 1);
          }
          throw err;
        }
      };

      // Build upload queue
      const chunksToUpload: number[] = [];
      for (let i = 0; i < chunks; i++) {
        if (!receivedSet.has(i)) chunksToUpload.push(i);
      }

      // Upload chunks with concurrency control
      const activeUploads = new Map<number, Promise<void>>();
      let queueIndex = 0;

      while (queueIndex < chunksToUpload.length || activeUploads.size > 0) {
        const maxConcurrent = adaptiveManager.getConcurrency();

        while (activeUploads.size < maxConcurrent && queueIndex < chunksToUpload.length) {
          const idx = chunksToUpload[queueIndex++];
          const uploadPromise = uploadWithRetry(idx).finally(() => {
            activeUploads.delete(idx);
          });
          activeUploads.set(idx, uploadPromise);
        }

        if (activeUploads.size > 0) {
          await Promise.race(Array.from(activeUploads.values()));
        }
      }

      adaptiveManager.stop();

      // Complete upload
      const completeRes = await fetch(`${DEFAULT_ENDPOINT}/complete/${uploadId}`, {
        method: 'POST',
        signal: abortController.signal,
      });

      if (!completeRes.ok) {
        const errorData = await completeRes.json().catch(() => ({}));
        const errorMsg = errorData.error || `Complete failed: ${completeRes.status}`;
        throw new Error(errorMsg);
      }

      const completeData = await completeRes.json();

      const endTime = performance.now();
      const uploadTime = ((endTime - fileState.startTime!) / 1000).toFixed(2) + 's';
      
      // Use the download URL from server response if available, otherwise construct it
      const downloadLink = completeData.download_url 
        ? `${DEFAULT_ENDPOINT.replace(/\/$/, '')}${completeData.download_url}`
        : `${DEFAULT_ENDPOINT.replace(/\/$/, '')}/static/${uploadId}/${encodeURIComponent(file.name)}`;

      // Calculate cost comparison
      const fileSizeMB = file.size / 1024 / 1024;
      const retryRate = totalRetries / chunks;
      const dynamicWastedMultiplier = Math.max(WASTED_MULTIPLIER, 1.0 + (retryRate * 5));
      const traditionalCost = fileSizeMB * COST_PER_MB * dynamicWastedMultiplier;
      const aetherLinkCost = fileSizeMB * COST_PER_MB;
      const savings = traditionalCost - aetherLinkCost;
      const savingsPercentage = (savings / traditionalCost) * 100;

      const costComparison: CostComparison = {
        traditionalCost,
        aetherLinkCost,
        savings,
        savingsPercentage,
        wastedMultiplier: dynamicWastedMultiplier,
      };

      const completedState: Partial<FileUploadState> = {
        status: 'completed',
        downloadLink,
        uploadTime,
        costComparison,
        progress: 100,
        activeWorkers: 0,
      };
      
      updateFileState(uploadId, completedState);

      // Pass updated file state to callback
      const updatedFileState = { ...fileState, ...completedState };
      callbacks?.onFileComplete?.(updatedFileState as FileUploadState);

    } catch (err: any) {
      const errorMessage = err?.message || 'Upload failed';
      
      const failedState: Partial<FileUploadState> = {
        status: isCancellingRef.current ? 'cancelled' : 'failed',
        error: errorMessage,
        activeWorkers: 0,
      };
      
      updateFileState(uploadId, failedState);

      if (!isCancellingRef.current) {
        const updatedFileState = { ...fileState, ...failedState };
        callbacks?.onFileError?.(updatedFileState as FileUploadState, errorMessage);
      }
    } finally {
      activeUploadsRef.current.delete(uploadId);
    }
  };

  // Start uploading multiple files
  const startMultiUpload = useCallback(async (
    files: File[],
    currentProfile: NetworkProfile,
    customShareId?: string
  ) => {
    if (files.length === 0) return;

    isCancellingRef.current = false;

    // Initialize file states
    const fileStates: FileUploadState[] = files.map((file, index) => ({
      file,
      uploadId: `${file.name.replace(/[^a-z0-9.-_]/gi, '')}-${Date.now()}-${index}`,
      shareId: '',
      status: 'pending',
      progress: 0,
      uploadedChunks: 0,
      totalChunks: 0,
      activeWorkers: 0,
      metrics: {
        successfulChunks: 0,
        failedRetries: 0,
        startTime: 0,
        bandwidth: 0,
        totalBytes: file.size,
        wastedBytes: 0,
      },
    }));

    setState({
      files: fileStates,
      isUploading: true,
      completedCount: 0,
      failedCount: 0,
      totalFiles: files.length,
      overallProgress: 0,
    });

    // Upload files with concurrency limit
    const uploadQueue = [...fileStates];
    const activeUploads: Promise<void>[] = [];

    while (uploadQueue.length > 0 || activeUploads.length > 0) {
      // Start new uploads up to max concurrent limit
      while (activeUploads.length < maxConcurrentFiles && uploadQueue.length > 0) {
        const fileState = uploadQueue.shift()!;
        const uploadPromise = uploadSingleFile(fileState, currentProfile, customShareId)
          .finally(() => {
            const index = activeUploads.indexOf(uploadPromise);
            if (index > -1) activeUploads.splice(index, 1);
          });
        activeUploads.push(uploadPromise);
      }

      // Wait for at least one upload to complete
      if (activeUploads.length > 0) {
        await Promise.race(activeUploads);
      }
    }

    // All uploads complete
    setState(prev => {
      const finalState = { ...prev, isUploading: false };
      callbacks?.onAllComplete?.(finalState.files);
      return finalState;
    });

  }, [maxConcurrentFiles, callbacks, updateFileState, uploadSingleFile]);

  // Cancel all uploads
  const cancelAllUploads = useCallback(() => {
    isCancellingRef.current = true;
    activeUploadsRef.current.forEach(controller => controller.abort());
    activeUploadsRef.current.clear();
    
    setState(prev => ({
      ...prev,
      isUploading: false,
      files: prev.files.map(f => 
        f.status === 'uploading' ? { ...f, status: 'cancelled' as const, activeWorkers: 0 } : f
      ),
    }));
  }, []);

  // Retry failed uploads
  const retryFailedUploads = useCallback(async (currentProfile: NetworkProfile) => {
    const failedFiles = state.files.filter(f => f.status === 'failed');
    if (failedFiles.length === 0) return;

    await startMultiUpload(
      failedFiles.map(f => f.file),
      currentProfile
    );
  }, [state.files, startMultiUpload]);

  // Remove completed/failed files from state
  const clearCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.status !== 'completed'),
      completedCount: 0,
    }));
  }, []);

  return {
    state,
    startMultiUpload,
    cancelAllUploads,
    retryFailedUploads,
    clearCompleted,
  };
}
