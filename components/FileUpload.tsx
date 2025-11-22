"use client";
import { useState } from "react";
import { UploadHeader } from "./upload/UploadHeader";
import { NetworkStatus } from "./upload/NetworkStatus";
import { ProgressDisplay } from "./upload/ProgressDisplay";
import { SuccessMessage } from "./upload/SuccessMessage";
import { ActivityPanel } from "./upload/ActivityPanel";
import { CostComparison as CostComparisonComponent } from "./upload/CostComparison";
import { TelemetryDashboard } from "./telemetry";
import { UploadButton } from "./upload/UploadButton";
import { CancelButton } from "./upload/CancelButton";
import { CancelDialog } from "./upload/CancelDialog";
import { CancelledMessage } from "./upload/CancelledMessage";
import { UploadControls } from "./upload/UploadControls";
import { AdvancedSettingsToggle } from "./upload/AdvancedSettingsToggle";
import { FileSelector } from "./upload/FileSelector";
import { ShareIDSetter } from "./upload/ShareIDSetter";
import { NetworkMonitorDisplay } from "./NetworkMonitorDisplay";
import { QRCodeGenerator } from "./upload/QRCodeGenerator";

import { useUploadState } from "@/hooks/useUploadState";
import { useNetworkDetection } from "@/hooks/useNetworkDetection";
import { useUploadPrevention } from "@/hooks/useUploadPrevention";
import { useUploadLogic } from "@/hooks/useUploadLogic";
import { useAdaptiveNetworkMonitor } from "@/hooks/useAdaptiveNetworkMonitor";
import { useUploadTelemetry } from "@/hooks/useUploadTelemetry";
import { handleFileChange as handleFileChangeUtil } from "@/utils/helpers/fileHandlers";
import { UploadModeToggle } from "./upload/UploadModeToggle";

export default function FileUpload() {
  const state = useUploadState();
  const { currentProfile } = useNetworkDetection(state.selectedProfile);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [useAdaptiveMode, setUseAdaptiveMode] = useState(false);
  const adaptiveNetwork = useAdaptiveNetworkMonitor(true, 1000); // Monitor every second

  const activeProfile = useAdaptiveMode ? adaptiveNetwork.adaptiveProfile : currentProfile;

  useUploadPrevention(state.isUploading, state.isCancelling);

  // Initialize telemetry tracking
  const telemetry = useUploadTelemetry({
    isUploading: state.isUploading,
    uploadedChunks: state.uploadedChunks,
    totalChunks: state.totalChunks,
    activeWorkers: state.activeWorkers,
    startTime: state.metrics.startTime,
  });

  const { startUpload } = useUploadLogic({
    isCancelling: state.isCancelling,
    setIsCompressing: state.setIsCompressing,
    setCompressionProgress: state.setCompressionProgress,
    setIsUploading: state.setIsUploading,
    setProgress: state.setProgress,
    setUploadedChunks: state.setUploadedChunks,
    setTotalChunks: state.setTotalChunks,
    setMetrics: state.setMetrics,
    setUploadTime: state.setUploadTime,
    setDownloadLink: state.setDownloadLink,
    setCostComparison: state.setCostComparison,
    setShareId: state.setShareId,
    setActiveWorkers: state.setActiveWorkers,
    // Wire up telemetry callbacks (adapter functions)
    onChunkStart: (_chunkId: string, index: number) => {
      telemetry.recordChunkStart(index);
    },
    onChunkComplete: (_chunkId: string, index: number, _durationMs: number, attempt: number) => {
      telemetry.recordChunkComplete(index, attempt - 1); // Convert attempt to retry count
    },
    onChunkError: (chunkId, index, error) => {
      console.warn(`Chunk ${index} error: ${error}`);
    },
    onConcurrencyChange: (newValue: number, oldValue: number, reason: string) => {
      telemetry.recordConcurrencyChange(newValue, reason);
    },
    onNetworkDegradation: telemetry.recordNetworkDegradation,
    onNetworkRecovery: telemetry.recordNetworkRecovery,
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileChangeUtil(event, state);
  };

  const handleUpload = async () => {
    if (!state.file) return;

    const uploadProfile = useAdaptiveMode ? adaptiveNetwork.adaptiveProfile : currentProfile;

    await startUpload(
      state.file,
      state.compressionSettings,
      uploadProfile, // Use locked profile
      state.shareId // Pass custom share ID if set
    );
  };

  const handleCancelClick = () => {
    state.setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    state.setIsCancelling(true);
    state.setShowCancelDialog(false);
    state.setIsUploading(false);
    state.setProgress(0);
    state.setUploadedChunks(0);
    setTimeout(() => {
      state.setIsCancelling(false);
    }, 2000);
  };

  const dismissCancelDialog = () => {
    state.setShowCancelDialog(false);
  };

  return (
    <div className="min-h-screen overflow-hidden dark bg-linear-to-br from-slate-950 via-cyan-950 to-slate-950">
      <div className="h-full flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto overflow-hidden">
        <div className="flex-1 lg:grow-2 flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 bg-slate-900/40 border-white/10">
              <div className="absolute inset-0 pointer-events-none bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10" />

              <UploadHeader />

              <div className="relative p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
                <UploadModeToggle />
                <FileSelector
                  file={state.file}
                  onFileChange={handleFileChange}
                />

                <ShareIDSetter
                  shareId={state.shareId}
                  onShareIdChange={state.setShareId}
                  isDark={true}
                  disabled={state.isUploading}
                />

                {/* QR Code Generator */}
                <QRCodeGenerator
                  shareId={state.shareId}
                  isDark={true}
                  disabled={state.isUploading}
                />

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl border bg-slate-800/50 border-white/10">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/20">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-xs sm:text-sm text-white">
                          Adaptive Mode
                        </h3>
                        <p className="text-xs text-gray-400 hidden sm:block">
                          Auto-optimize chunk size based on network
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseAdaptiveMode(!useAdaptiveMode)}
                      disabled={state.isUploading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useAdaptiveMode ? 'bg-cyan-500' : 'bg-gray-700'} ${state.isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      title={state.isUploading ? 'Cannot change mode during upload' : 'Toggle adaptive mode'}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useAdaptiveMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {useAdaptiveMode && (
                    <NetworkMonitorDisplay
                      networkState={adaptiveNetwork}
                      className="animate-in fade-in slide-in-from-top-2 duration-300"
                    />
                  )}
                </div>

                <AdvancedSettingsToggle
                  isOpen={showAdvanced}
                  onToggle={() => setShowAdvanced(!showAdvanced)}
                />

                {showAdvanced && (
                  <div className="space-y-4 sm:space-y-5 lg:space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <UploadControls
                      selectedProfile={state.selectedProfile}
                      onProfileChange={state.setSelectedProfile}
                      file={state.file}
                      onFileChange={handleFileChange}
                      compressionSettings={state.compressionSettings}
                      onCompressionChange={state.setCompressionSettings}
                      workers={activeProfile.workers}
                      isUploading={state.isUploading}
                      isDark={true}
                    />

                  </div>
                )}

                <UploadButton
                  file={state.file}
                  isUploading={state.isUploading}
                  isCompressing={state.isCompressing}
                  compressionProgress={state.compressionProgress}
                  progress={state.progress}
                  onUpload={handleUpload}
                  isDark={true}
                />

                {state.isUploading && state.totalChunks > 0 && (
                  <>
                    <ProgressDisplay
                      progress={state.progress}
                      totalChunks={state.totalChunks}
                      uploadedChunks={state.uploadedChunks}
                      isDark={true}
                    />

                    <CancelButton
                      onClick={handleCancelClick}
                      isDark={true}
                    />
                  </>
                )}

                {state.isCancelling && <CancelledMessage isDark={true} />}

                {state.downloadLink && (
                  <SuccessMessage
                    downloadLink={state.downloadLink}
                    uploadTime={state.uploadTime}
                    isDark={true}
                    shareId={state.shareId}
                  />
                )}

                {/* Enhanced Telemetry Dashboard */}
                {(state.isUploading || state.downloadLink || telemetry.telemetry.latencyPoints.length > 0) && (
                  <TelemetryDashboard
                    telemetry={telemetry.telemetry}
                    totalChunks={state.totalChunks}
                    isDark={true}
                    isUploading={state.isUploading}
                  />
                )}

                {/* Legacy Cost Comparison (optional) */}
                {state.costComparison && state.downloadLink && (
                  <CostComparisonComponent
                    costComparison={state.costComparison}
                    metrics={state.metrics}
                    totalChunks={state.totalChunks}
                    isDark={true}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 lg:grow flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <ActivityPanel
              isUploading={state.isUploading}
              downloadLink={state.downloadLink}
              uploadTime={state.uploadTime}
              progress={state.progress}
              uploadedChunks={state.uploadedChunks}
              totalChunks={state.totalChunks}
              currentProfile={activeProfile}
              isDark={true}
              activeWorkers={state.activeWorkers}
            />
          </div>
        </div>
      </div>

      <CancelDialog
        show={state.showCancelDialog}
        uploadedChunks={state.uploadedChunks}
        totalChunks={state.totalChunks}
        progress={state.progress}
        chunkSize={activeProfile.chunkSize}
        isDark={true}
        onConfirm={confirmCancel}
        onDismiss={dismissCancelDialog}
      />
    </div>
  );
}
