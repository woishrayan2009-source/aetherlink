"use client";
import { useState } from "react";
import { UploadHeader } from "./upload/UploadHeader";
import { MultiFileSelector } from "./upload/MultiFileSelector";
import { MultiFileOverview } from "./upload/MultiFileOverview";
import { MultiFileProgressList } from "./upload/MultiFileProgressList";
import { ShareIDSetter } from "./upload/ShareIDSetter";
import { NetworkMonitorDisplay } from "./NetworkMonitorDisplay";
import { AdvancedSettingsToggle } from "./upload/AdvancedSettingsToggle";
import { NetworkSelector } from "./upload/NetworkSelector";
import { UploadModeToggle } from "./upload/UploadModeToggle";
import { QRCodeGenerator } from "./upload/QRCodeGenerator";

import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { useNetworkDetection } from "@/hooks/useNetworkDetection";
import { useAdaptiveNetworkMonitor } from "@/hooks/useAdaptiveNetworkMonitor";
import { NETWORK_PROFILES } from "@/types/NetworkProfile";

export default function MultiFileUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("normal");
  const [customShareId, setCustomShareId] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useAdaptiveMode, setUseAdaptiveMode] = useState(false);
  const [maxConcurrentFiles, setMaxConcurrentFiles] = useState(3);

  const { currentProfile } = useNetworkDetection(selectedProfile);
  const adaptiveNetwork = useAdaptiveNetworkMonitor(true, 1000);
  const activeProfile = useAdaptiveMode ? adaptiveNetwork.adaptiveProfile : currentProfile;

  const multiUpload = useMultiFileUpload({
    maxConcurrentFiles,
    callbacks: {
      onFileComplete: (fileState) => {
        console.log(`✅ File completed: ${fileState.file.name}`);
      },
      onFileError: (fileState, error) => {
        console.error(`❌ File failed: ${fileState.file.name}`, error);
      },
      onAllComplete: (results) => {
        const successCount = results.filter(f => f.status === 'completed').length;
        const failCount = results.filter(f => f.status === 'failed').length;
        console.log(`🎉 All uploads complete! Success: ${successCount}, Failed: ${failCount}`);
      },
    },
  });

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Append new files to existing selection
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;
    await multiUpload.startMultiUpload(selectedFiles, activeProfile, customShareId);
  };

  const handleCancelAll = () => {
    multiUpload.cancelAllUploads();
  };

  const handleRetryFailed = async () => {
    await multiUpload.retryFailedUploads(activeProfile);
  };

  const canStartUpload = selectedFiles.length > 0 && !multiUpload.state.isUploading;

  return (
    <div className="min-h-screen overflow-hidden dark bg-linear-to-br from-slate-950 via-cyan-950 to-slate-950">
      <div className="h-full flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto overflow-hidden">
        {/* Left Panel - Upload Controls */}
        <div className="flex-1 lg:grow-2 flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 bg-slate-900/40 border-white/10">
              <div className="absolute inset-0 pointer-events-none bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10" />

              <UploadHeader />

              <div className="relative p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
                <UploadModeToggle />
                
                {/* Multi-File Selector */}
                <MultiFileSelector
                  files={selectedFiles}
                  onFilesChange={handleFilesChange}
                  disabled={multiUpload.state.isUploading}
                />

                {/* File Actions */}
                {selectedFiles.length > 0 && !multiUpload.state.isUploading && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearFiles}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                    >
                      Clear All ({selectedFiles.length})
                    </button>
                  </div>
                )}

                {/* Share ID Setter */}
                <ShareIDSetter
                  shareId={customShareId}
                  onShareIdChange={setCustomShareId}
                  isDark={true}
                  disabled={multiUpload.state.isUploading}
                />

                {/* QR Code Generator */}
                <QRCodeGenerator
                  shareId={customShareId}
                  isDark={true}
                  disabled={multiUpload.state.isUploading}
                />

                {/* Adaptive Mode Toggle */}
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
                      disabled={multiUpload.state.isUploading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useAdaptiveMode ? 'bg-cyan-500' : 'bg-gray-700'
                      } ${multiUpload.state.isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useAdaptiveMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {useAdaptiveMode && (
                    <NetworkMonitorDisplay
                      networkState={adaptiveNetwork}
                      className="animate-in fade-in slide-in-from-top-2 duration-300"
                    />
                  )}
                </div>

                {/* Advanced Settings */}
                <AdvancedSettingsToggle
                  isOpen={showAdvanced}
                  onToggle={() => setShowAdvanced(!showAdvanced)}
                />

                {showAdvanced && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <NetworkSelector
                      selectedProfile={selectedProfile}
                      onProfileChange={setSelectedProfile}
                      isDark={true}
                      isUploading={multiUpload.state.isUploading}
                    />

                    {/* Max Concurrent Files Setting */}
                    <div className="p-4 rounded-xl border bg-slate-800/50 border-white/10">
                      <label className="block text-sm font-medium text-white mb-2">
                        Max Concurrent Files
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={maxConcurrentFiles}
                        onChange={(e) => setMaxConcurrentFiles(parseInt(e.target.value) || 1)}
                        disabled={multiUpload.state.isUploading}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Number of files to upload simultaneously (1-10)
                      </p>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <button
                  onClick={handleStartUpload}
                  disabled={!canStartUpload}
                  className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                    canStartUpload
                      ? 'bg-linear-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/50 hover:scale-[1.02]'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {multiUpload.state.isUploading 
                    ? 'Uploading...' 
                    : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
                </button>

                {/* Action Buttons During Upload */}
                {multiUpload.state.isUploading && (
                  <button
                    onClick={handleCancelAll}
                    className="w-full py-3 rounded-xl font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  >
                    Cancel All Uploads
                  </button>
                )}

                {/* Retry Failed Button */}
                {multiUpload.state.failedCount > 0 && !multiUpload.state.isUploading && (
                  <button
                    onClick={handleRetryFailed}
                    className="w-full py-3 rounded-xl font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                  >
                    Retry Failed Uploads ({multiUpload.state.failedCount})
                  </button>
                )}

                {/* Clear Completed Button */}
                {multiUpload.state.completedCount > 0 && !multiUpload.state.isUploading && (
                  <button
                    onClick={multiUpload.clearCompleted}
                    className="w-full py-3 rounded-xl font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                  >
                    Clear Completed ({multiUpload.state.completedCount})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Progress Display */}
        <div className="flex-1 lg:grow flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {/* Overview */}
              <MultiFileOverview state={multiUpload.state} isDark={true} />

              {/* Individual File Progress */}
              {multiUpload.state.files.length > 0 && (
                <div className="backdrop-blur-2xl rounded-2xl shadow-2xl border p-4 sm:p-6 bg-slate-900/40 border-white/10">
                  <MultiFileProgressList files={multiUpload.state.files} isDark={true} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
