"use client";
import { useEffect, useState } from "react";
import { bufferToHex, detectConnectionSpeed, uploadChunk } from "@/utils/helpers/file";
import { compressFile, isCompressible as checkCompressible } from "@/utils/helpers/compression";
import { NETWORK_PROFILES } from "@/types/NetworkProfile";
import { Priority, UploadMetrics, CostComparison, COST_PER_MB, WASTED_MULTIPLIER } from "@/types/UploadMetrics";

import { ThemeToggle } from "./upload/ThemeToggle";
import { UploadHeader } from "./upload/UploadHeader";
import { NetworkSelector } from "./upload/NetworkSelector";
import { PrioritySelector } from "./upload/PrioritySelector";
import { NetworkStatus } from "./upload/NetworkStatus";
import { FileSelector } from "./upload/FileSelector";
import { ParallelToggle } from "./upload/ParallelToggle";
import { ProgressDisplay } from "./upload/ProgressDisplay";
import { SuccessMessage } from "./upload/SuccessMessage";
import { ActivityPanel } from "./upload/ActivityPanel";
import { CostComparison as CostComparisonComponent } from "./upload/CostComparison";
import { CompressionToggle, CompressionSettings } from "./upload/CompressionToggle";
import { MultiDestination, Destination } from "./upload/MultiDestination";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [parallel, setParallel] = useState(false);
  const [downloadLink, setDownloadLink] = useState("");
  const [uploadTime, setUploadTime] = useState<string>("");
  const [networkInfo, setNetworkInfo] = useState({ type: "Auto", chunkSize: 10 * 1024 * 1024 });
  const [totalChunks, setTotalChunks] = useState(0);
  const [uploadedChunks, setUploadedChunks] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<string>("normal");
  const [isDark, setIsDark] = useState(true);
  const [costComparison, setCostComparison] = useState<CostComparison | null>(null);
  const [metrics, setMetrics] = useState<UploadMetrics>({
    successfulChunks: 0,
    failedRetries: 0,
    startTime: 0,
    bandwidth: 0,
    totalBytes: 0,
    wastedBytes: 0
  });
  
  // FEATURE 11: Compression state
  const [compressionSettings, setCompressionSettings] = useState<CompressionSettings>({
    enabled: false,
    quality: 70,
    level: 'balanced',
    estimatedSize: 0,
    originalSize: 0
  });
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  
  // FEATURE 12: Multi-destination state
  const [destinations, setDestinations] = useState<Destination[]>([
    {
      id: '1',
      name: 'Primary Server',
      type: 'custom',
      endpoint: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080',
      enabled: true,
      status: 'pending'
    }
  ]);

  const currentProfile = NETWORK_PROFILES[selectedProfile];
  const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading && !isCancelling) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isUploading, isCancelling]);

  useEffect(() => {
    const updateNetwork = async () => {
      if (selectedProfile === "normal") {
        const info = await detectConnectionSpeed();
        setNetworkInfo(info);
      } else {
        setNetworkInfo({
          type: currentProfile.speed,
          chunkSize: currentProfile.chunkSize
        });
      }
    };

    updateNetwork();

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener("change", updateNetwork);
      return () => connection.removeEventListener("change", updateNetwork);
    }
  }, [selectedProfile, currentProfile.speed, currentProfile.chunkSize]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setProgress(0);
    setDownloadLink("");
    setUploadTime("");
    setUploadedChunks(0);
    setMetrics({
      successfulChunks: 0,
      failedRetries: 0,
      startTime: 0,
      bandwidth: 0,
      totalBytes: 0,
      wastedBytes: 0
    });
    setCostComparison(null);
    
    const savedPriority = localStorage.getItem('upload-priority') as Priority | null;
    if (savedPriority && ['high', 'medium', 'low'].includes(savedPriority)) {
      setPriority(savedPriority);
    }
  };

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    setIsCancelling(true);
    setShowCancelDialog(false);
    setIsUploading(false);
    setProgress(0);
    setUploadedChunks(0);
    // Reset after a brief delay to show cancellation message
    setTimeout(() => {
      setIsCancelling(false);
    }, 2000);
  };

  const dismissCancelDialog = () => {
    setShowCancelDialog(false);
  };

  const startUpload = async () => {
    if (!file) return alert("Select a file first.");
    if (!API_URL) return alert("API_URL not set");

    const enabledDestinations = destinations.filter(d => d.enabled);
    if (enabledDestinations.length === 0) {
      return alert("Please enable at least one destination");
    }

    setIsUploading(true);
    setIsCancelling(false);
    setProgress(0);
    setUploadTime("");
    setUploadedChunks(0);

    localStorage.setItem('upload-priority', priority);

    // FEATURE 11: Compress file if enabled
    let fileToUpload = file;
    if (compressionSettings.enabled && checkCompressible(file)) {
      try {
        setIsCompressing(true);
        console.log('Starting compression...');
        fileToUpload = await compressFile(
          file,
          {
            quality: compressionSettings.quality,
            level: compressionSettings.level
          },
          (progress) => {
            setCompressionProgress(progress);
          }
        );
        console.log(`Compression complete: ${file.size} → ${fileToUpload.size} bytes`);
        setIsCompressing(false);
        setCompressionProgress(0);
      } catch (error) {
        console.error('Compression failed:', error);
        setIsCompressing(false);
        const shouldContinue = confirm(
          `Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nDo you want to upload the original file instead?`
        );
        if (!shouldContinue) {
          setIsUploading(false);
          return;
        }
      }
    }

    const startTime = performance.now();
    setMetrics(prev => ({ ...prev, startTime, totalBytes: fileToUpload.size }));
    
    // FEATURE 12: Upload to multiple destinations
    try {
      // Update all destinations to uploading status
      setDestinations(prev => prev.map(d => 
        d.enabled ? { ...d, status: 'uploading' as const, progress: 0 } : d
      ));

      // Upload to each enabled destination in parallel
      const uploadPromises = enabledDestinations.map(async (dest) => {
        try {
          await uploadToDestination(fileToUpload, dest, startTime);
          // Update destination status to success
          setDestinations(prev => prev.map(d => 
            d.id === dest.id ? { ...d, status: 'success' as const, progress: 100 } : d
          ));
        } catch (error) {
          console.error(`Upload to ${dest.name} failed:`, error);
          // Update destination status to failed
          setDestinations(prev => prev.map(d => 
            d.id === dest.id ? { ...d, status: 'failed' as const } : d
          ));
          throw error;
        }
      });

      await Promise.all(uploadPromises);

      const endTime = performance.now();
      setUploadTime(((endTime - startTime) / 1000).toFixed(2) + "s");
      
      // Set download link from primary destination
      const primaryDest = enabledDestinations[0];
      const uploadID = `${fileToUpload.name.replace(/[^a-z0-9.-_]/gi, "")}-${Date.now()}`;
      setDownloadLink(`${primaryDest.endpoint.replace(/\/$/, "")}/static/${uploadID}/${encodeURIComponent(fileToUpload.name)}`);
    } catch (err: any) {
      if (isCancelling || err?.message === 'Upload cancelled by user') {
        console.log('Upload cancelled by user');
      } else {
        alert("Upload failed: " + (err?.message || err));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const uploadToDestination = async (file: File, destination: Destination, startTime: number) => {
    const CHUNK_SIZE = currentProfile.chunkSize;
    const MAX_WORKERS = currentProfile.workers;
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    setTotalChunks(chunks);

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

    const initRes = await fetch(`${destination.endpoint}/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    if (!initRes.ok) throw new Error(`init failed for ${destination.name}: ${initRes.status}`);

    const statusRes = await fetch(`${destination.endpoint}/status/${uploadID}`);
    let received: number[] = [];
    if (statusRes.ok) {
      const parsed = await statusRes.json() as { received_chunks: number[] };
      received = parsed.received_chunks || [];
    }
    const receivedSet = new Set<number>(received);

    let uploadedCount = received.length;
    let totalRetries = 0;
    setUploadedChunks(uploadedCount);
    setProgress(Math.round((uploadedCount / chunks) * 100));

    const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
      if (isCancelling) {
        throw new Error('Upload cancelled by user');
      }
      
      const start = idx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const chunkPriority = priority;
      try {
        await uploadChunk(uploadID, idx, blob, chunkPriority, currentProfile, destination.endpoint);
        uploadedCount++;
        setUploadedChunks(uploadedCount);
        const progressPct = Math.round((uploadedCount / chunks) * 100);
        setProgress(progressPct);
        
        // Update destination progress
        setDestinations(prev => prev.map(d => 
          d.id === destination.id ? { ...d, progress: progressPct } : d
        ));
        
        setMetrics(prev => ({ 
          ...prev, 
          successfulChunks: uploadedCount,
          bandwidth: (file.size / ((performance.now() - startTime) / 1000)) / 1024 / 1024
        }));
      } catch (err) {
        if (isCancelling || (err as Error).message === 'Upload cancelled by user') {
          throw err;
        }
        
        totalRetries++;
        setMetrics(prev => ({ 
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

    if (parallel) {
      const chunksToUpload: number[] = [];
      for (let i = 0; i < chunks; i++) {
        if (!receivedSet.has(i)) chunksToUpload.push(i);
      }

      for (let i = 0; i < chunksToUpload.length; i += MAX_WORKERS) {
        const batch = chunksToUpload.slice(i, i + MAX_WORKERS);
        await Promise.all(batch.map((idx) => uploadWithRetry(idx)));
      }
    } else {
      for (let i = 0; i < chunks; i++) {
        if (receivedSet.has(i)) continue;
        await uploadWithRetry(i);
      }
    }

    const completeRes = await fetch(`${destination.endpoint}/complete/${uploadID}`, { method: "POST" });
    if (!completeRes.ok) throw new Error(`complete failed for ${destination.name}: ${completeRes.status}`);

    // Calculate cost comparison
    const fileSizeMB = file.size / 1024 / 1024;
    const retryRate = totalRetries / chunks;
    const dynamicWastedMultiplier = Math.max(
      WASTED_MULTIPLIER,
      1.0 + (retryRate * 5)
    );
    
    const traditionalCost = fileSizeMB * COST_PER_MB * dynamicWastedMultiplier;
    const aetherLinkCost = fileSizeMB * COST_PER_MB;
    const savings = traditionalCost - aetherLinkCost;
    const savingsPercentage = (savings / traditionalCost) * 100;
    
    setCostComparison({
      traditionalCost,
      aetherLinkCost,
      savings,
      savingsPercentage,
      wastedMultiplier: dynamicWastedMultiplier
    });
  };

  return (
    <div className={`h-screen overflow-hidden ${isDark ? 'dark bg-linear-to-br from-slate-950 via-cyan-950 to-slate-950' : 'bg-linear-to-br from-sky-50 via-cyan-50 to-blue-50'} transition-colors duration-300`}>
      <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />

      <div className="h-full flex flex-col lg:flex-row gap-6 p-4 lg:p-6 max-w-7xl mx-auto overflow-hidden">
        {/* Main Upload Box */}
        <div className="flex-1 lg:grow-2 flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className={`backdrop-blur-2xl rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 ${isDark
              ? 'bg-slate-900/40 border-white/10'
              : 'bg-white/60 border-cyan-200'
              }`}>
              <div className={`absolute inset-0 pointer-events-none ${isDark
                ? 'bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10'
                : 'bg-linear-to-br from-cyan-200/20 via-blue-200/20 to-cyan-200/20'
                }`} />

              <UploadHeader isDark={isDark} />

              <div className="relative p-8 space-y-6">
                <NetworkSelector
                  selectedProfile={selectedProfile}
                  onProfileChange={setSelectedProfile}
                  isUploading={isUploading}
                  isDark={isDark}
                />

                <PrioritySelector
                  priority={priority}
                  onPriorityChange={setPriority}
                  isUploading={isUploading}
                  isDark={isDark}
                />

                <NetworkStatus profile={currentProfile} isDark={isDark} />

                <FileSelector
                  file={file}
                  onFileChange={handleFileChange}
                  isDark={isDark}
                />

                {/* FEATURE 11: Compression Toggle */}
                <CompressionToggle
                  file={file}
                  settings={compressionSettings}
                  onSettingsChange={setCompressionSettings}
                  isDark={isDark}
                  isUploading={isUploading}
                />

                {/* FEATURE 12: Multi-Destination Upload */}
                <MultiDestination
                  destinations={destinations}
                  onDestinationsChange={setDestinations}
                  isDark={isDark}
                  isUploading={isUploading}
                />

                <ParallelToggle
                  parallel={parallel}
                  workers={currentProfile.workers}
                  onToggle={() => setParallel(!parallel)}
                  isDark={isDark}
                />

                <button
                  disabled={!file || isUploading}
                  onClick={startUpload}
                  className={`w-full font-semibold py-4 rounded-xl backdrop-blur-xl border shadow-lg transition-all duration-300 ${!file || isUploading
                    ? isDark
                      ? "bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
                      : "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed"
                    : isDark
                      ? "bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 border-white/10 text-white"
                      : "bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-cyan-600 text-white"
                    }`}
                >
                  {isCompressing ? (
                    <span>Compressing... {compressionProgress}%</span>
                  ) : isUploading ? (
                    <span>Uploading... {progress}%</span>
                  ) : (
                    <span>Start Upload</span>
                  )}
                </button>

                {isUploading && totalChunks > 0 && (
                  <>
                    <ProgressDisplay
                      progress={progress}
                      totalChunks={totalChunks}
                      uploadedChunks={uploadedChunks}
                      isDark={isDark}
                    />
                    
                    {/* FEATURE 2: Cancel Upload Button */}
                    <button
                      onClick={handleCancelClick}
                      className={`w-full font-semibold py-4 rounded-xl backdrop-blur-xl border shadow-lg transition-all duration-300 ${
                        isDark
                          ? "bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-red-500/50 text-white"
                          : "bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-red-600 text-white"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span>❌</span>
                        <span>Cancel Upload</span>
                      </span>
                    </button>
                  </>
                )}

                {isCancelling && (
                  <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${
                    isDark
                      ? 'bg-linear-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
                      : 'bg-linear-to-br from-yellow-100 to-orange-100 border-yellow-300'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border transition-all duration-300 ${
                        isDark ? 'bg-yellow-500/30 border-yellow-400/40' : 'bg-yellow-200 border-yellow-400'
                      }`}>
                        <span className="text-2xl">⚠️</span>
                      </div>
                      <div>
                        <p className={`font-semibold transition-colors duration-300 ${
                          isDark ? 'text-yellow-400' : 'text-yellow-700'
                        }`}>Upload Cancelled</p>
                        <p className={`text-sm transition-colors duration-300 ${
                          isDark ? 'text-yellow-300/70' : 'text-yellow-600'
                        }`}>Upload was stopped by user</p>
                      </div>
                    </div>
                  </div>
                )}

                {downloadLink && (
                  <SuccessMessage
                    downloadLink={downloadLink}
                    uploadTime={uploadTime}
                    isDark={isDark}
                  />
                )}

                {costComparison && (
                  <CostComparisonComponent
                    costComparison={costComparison}
                    metrics={metrics}
                    totalChunks={totalChunks}
                    isDark={isDark}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 lg:grow flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <ActivityPanel
              isUploading={isUploading}
              downloadLink={downloadLink}
              uploadTime={uploadTime}
              progress={progress}
              uploadedChunks={uploadedChunks}
              totalChunks={totalChunks}
              parallel={parallel}
              currentProfile={currentProfile}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* FEATURE 2: Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`max-w-md w-full rounded-2xl border shadow-2xl transition-all duration-300 ${
            isDark
              ? 'bg-slate-900/95 border-red-500/30'
              : 'bg-white/95 border-red-300'
          }`}>
            <div className={`p-6 border-b ${isDark ? 'border-red-500/20' : 'border-red-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-red-500/20' : 'bg-red-100'
                }`}>
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Cancel Upload?
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {uploadedChunks} of {totalChunks} chunks uploaded
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Are you sure you want to cancel this upload? Your progress will be lost and you&apos;ll need to start over.
              </p>

              <div className={`p-4 rounded-lg ${
                isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <p className={`text-xs ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  <strong>⚡ Progress:</strong> {progress}% complete ({formatBytes(uploadedChunks * currentProfile.chunkSize)} uploaded)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={dismissCancelDialog}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                  }`}
                >
                  Continue Upload
                </button>
                <button
                  onClick={confirmCancel}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                    isDark
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for formatting bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
