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

import { useUploadState } from "@/hooks/useUploadState";
import { useNetworkDetection } from "@/hooks/useNetworkDetection";
import { useUploadPrevention } from "@/hooks/useUploadPrevention";
import { useUploadLogic } from "@/hooks/useUploadLogic";
import { handleFileChange as handleFileChangeUtil } from "@/utils/helpers/fileHandlers";

export default function FileUpload() {
  const state = useUploadState();
  const { currentProfile } = useNetworkDetection(state.selectedProfile);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileChangeUtil(event, state);
  };

  const handleUpload = async () => {
    if (!state.file) return;
    await startUpload(
      state.file,
      state.priority,
      state.compressionSettings,
      currentProfile
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
                      priority={state.priority}
                      onPriorityChange={state.setPriority}
                      file={state.file}
                      onFileChange={handleFileChange}
                      compressionSettings={state.compressionSettings}
                      onCompressionChange={state.setCompressionSettings}
                      parallel={state.parallel}
                      onParallelToggle={() => state.setParallel(!state.parallel)}
                      workers={currentProfile.workers}
                      isUploading={state.isUploading}
                      isDark={state.isDark}
                    />

                    <NetworkStatus profile={currentProfile} isDark={state.isDark} />
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
              parallel={state.parallel}
              currentProfile={currentProfile}
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
        chunkSize={currentProfile.chunkSize}
        isDark={state.isDark}
        onConfirm={confirmCancel}
        onDismiss={dismissCancelDialog}
      />
    </div>
  );
}
