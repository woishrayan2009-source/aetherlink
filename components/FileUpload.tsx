"use client";
import { useState } from "react";
import { ThemeToggle } from "./upload/ThemeToggle";
import { UploadHeader } from "./upload/UploadHeader";
import { NetworkStatus } from "./upload/NetworkStatus";
import { ProgressDisplay } from "./upload/ProgressDisplay";
import { SuccessMessage } from "./upload/SuccessMessage";
import { ActivityPanel } from "./upload/ActivityPanel";
import { CostComparison as CostComparisonComponent } from "./upload/CostComparison";
import { UploadButton } from "./upload/UploadButton";
import { CancelButton } from "./upload/CancelButton";
import { CancelDialog } from "./upload/CancelDialog";
import { CancelledMessage } from "./upload/CancelledMessage";
import { UploadControls } from "./upload/UploadControls";
import { AdvancedSettingsToggle } from "./upload/AdvancedSettingsToggle";
import { FileSelector } from "./upload/FileSelector";
import { NetworkMonitorDisplay } from "./NetworkMonitorDisplay";

import { useUploadState } from "@/hooks/useUploadState";
import { useNetworkDetection } from "@/hooks/useNetworkDetection";
import { useUploadPrevention } from "@/hooks/useUploadPrevention";
import { useUploadLogic } from "@/hooks/useUploadLogic";
import { useAdaptiveNetworkMonitor } from "@/hooks/useAdaptiveNetworkMonitor";
import { handleFileChange as handleFileChangeUtil } from "@/utils/helpers/fileHandlers";

export default function FileUpload() {
  const state = useUploadState();
  const { currentProfile } = useNetworkDetection(state.selectedProfile);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Enable adaptive network monitoring - runs constantly in background
  const [useAdaptiveMode, setUseAdaptiveMode] = useState(false);
  const adaptiveNetwork = useAdaptiveNetworkMonitor(true, 1000); // Monitor every second

  // Use adaptive profile if enabled, otherwise use manual selection
  const activeProfile = useAdaptiveMode ? adaptiveNetwork.adaptiveProfile : currentProfile;

  useUploadPrevention(state.isUploading, state.isCancelling);

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
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileChangeUtil(event, state);
  };

  const handleUpload = async () => {
    if (!state.file) return;
    
    // Lock the profile at upload start to prevent mid-upload changes
    const uploadProfile = useAdaptiveMode ? adaptiveNetwork.adaptiveProfile : currentProfile;
    
    await startUpload(
      state.file,
      state.compressionSettings,
      uploadProfile // Use locked profile
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
    <div className={`h-screen overflow-hidden ${state.isDark ? 'dark bg-linear-to-br from-slate-950 via-cyan-950 to-slate-950' : 'bg-linear-to-br from-sky-50 via-cyan-50 to-blue-50'} transition-colors duration-300`}>
      <ThemeToggle isDark={state.isDark} onToggle={() => state.setIsDark(!state.isDark)} />

      <div className="h-full flex flex-col lg:flex-row gap-6 p-4 lg:p-6 max-w-7xl mx-auto overflow-hidden">
        <div className="flex-1 lg:grow-2 flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className={`backdrop-blur-2xl rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 ${state.isDark
              ? 'bg-slate-900/40 border-white/10'
              : 'bg-white/60 border-cyan-200'
              }`}>
              <div className={`absolute inset-0 pointer-events-none ${state.isDark
                ? 'bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10'
                : 'bg-linear-to-br from-cyan-200/20 via-blue-200/20 to-cyan-200/20'
                }`} />

              <UploadHeader isDark={state.isDark} />

              <div className="relative p-8 space-y-6">
                <FileSelector
                  file={state.file}
                  onFileChange={handleFileChange}
                  isDark={state.isDark}
                />

                {/* Adaptive Network Monitor - Always visible, compact */}
                <div className="space-y-4">
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${state.isDark ? 'bg-slate-800/50 border-white/10' : 'bg-white/80 border-cyan-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${state.isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                        <svg className={`w-5 h-5 ${state.isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className={`font-semibold text-sm ${state.isDark ? 'text-white' : 'text-gray-900'}`}>
                          Adaptive Mode
                        </h3>
                        <p className={`text-xs ${state.isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Auto-optimize chunk size based on network
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseAdaptiveMode(!useAdaptiveMode)}
                      disabled={state.isUploading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useAdaptiveMode ? 'bg-cyan-500' : state.isDark ? 'bg-gray-700' : 'bg-gray-300'} ${state.isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                  isDark={state.isDark}
                />

                {showAdvanced && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <UploadControls
                      selectedProfile={state.selectedProfile}
                      onProfileChange={state.setSelectedProfile}
                      file={state.file}
                      onFileChange={handleFileChange}
                      compressionSettings={state.compressionSettings}
                      onCompressionChange={state.setCompressionSettings}
                      workers={activeProfile.workers}
                      isUploading={state.isUploading}
                      isDark={state.isDark}
                    />

                    {/* <NetworkStatus profile={activeProfile} isDark={state.isDark} /> */}
                  </div>
                )}

                <UploadButton
                  file={state.file}
                  isUploading={state.isUploading}
                  isCompressing={state.isCompressing}
                  compressionProgress={state.compressionProgress}
                  progress={state.progress}
                  onUpload={handleUpload}
                  isDark={state.isDark}
                />

                {state.isUploading && state.totalChunks > 0 && (
                  <>
                    <ProgressDisplay
                      progress={state.progress}
                      totalChunks={state.totalChunks}
                      uploadedChunks={state.uploadedChunks}
                      isDark={state.isDark}
                    />

                    <CancelButton
                      onClick={handleCancelClick}
                      isDark={state.isDark}
                    />
                  </>
                )}

                {state.isCancelling && <CancelledMessage isDark={state.isDark} />}

                {state.downloadLink && (
                  <SuccessMessage
                    downloadLink={state.downloadLink}
                    uploadTime={state.uploadTime}
                    isDark={state.isDark}
                    shareId={state.shareId}
                  />
                )}

                {state.costComparison && (
                  <CostComparisonComponent
                    costComparison={state.costComparison}
                    metrics={state.metrics}
                    totalChunks={state.totalChunks}
                    isDark={state.isDark}
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
              isDark={state.isDark}
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
        isDark={state.isDark}
        onConfirm={confirmCancel}
        onDismiss={dismissCancelDialog}
      />
    </div>
  );
}
