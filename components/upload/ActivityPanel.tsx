"use client";
import { Upload, Check } from "lucide-react";
import { NetworkProfile } from "@/types/NetworkProfile";

interface ActivityPanelProps {
  isUploading: boolean;
  downloadLink: string;
  uploadTime: string;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  currentProfile: NetworkProfile;
  isDark: boolean;
  activeWorkers: number;
}

export function ActivityPanel({
  isUploading,
  downloadLink,
  uploadTime,
  progress,
  uploadedChunks,
  totalChunks,
  currentProfile,
  isDark,
  activeWorkers
}: ActivityPanelProps) {
  return (
    <div className={`backdrop-blur-2xl rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 flex flex-col ${
      isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/60 border-cyan-200'
    }`}>
      <div className={`relative backdrop-blur-xl p-6 text-center border-b transition-all duration-300 shrink-0 ${
        isDark
          ? 'bg-linear-to-r from-cyan-600/20 to-blue-600/20 border-white/10'
          : 'bg-linear-to-r from-cyan-200/60 to-blue-200/60 border-cyan-300'
      }`}>
        <h2 className={`text-xl font-bold transition-colors duration-300 ${
          isDark ? 'text-white' : 'text-cyan-900'
        }`}>Upload Activity</h2>
      </div>

      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {isUploading ? (
          <UploadingState
            progress={progress}
            uploadedChunks={uploadedChunks}
            totalChunks={totalChunks}
            currentProfile={currentProfile}
            isDark={isDark}
            activeWorkers={activeWorkers}
          />
        ) : downloadLink ? (
          <SuccessState
            uploadTime={uploadTime}
            uploadedChunks={uploadedChunks}
            isDark={isDark}
          />
        ) : (
          <IdleState isDark={isDark} />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 text-center p-4 border-t border-white/10">
        <p className={`text-sm transition-colors duration-300 ${
          isDark ? 'text-slate-500' : 'text-cyan-600'
        }`}>
          Powered by AetherLink
        </p>
      </div>
    </div>
  );
}

function UploadingState({ progress, uploadedChunks, totalChunks, currentProfile, isDark, activeWorkers }: any) {
  // DEFENSIVE: Clamp activeWorkers to never exceed maxWorkers in UI
  const maxWorkers = currentProfile.workers;
  const displayWorkers = Math.min(activeWorkers, maxWorkers);
  
  // Detect and log UI overflow (shouldn't happen with backend fixes)
  if (activeWorkers > maxWorkers) {
    console.error(`❌ UI OVERFLOW DETECTED: ${activeWorkers} active workers > ${maxWorkers} max workers`);
  }
  
  return (
    <div className="space-y-6">
      {/* Pulsing Upload Icon */}
      <div className="flex justify-center">
        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
          isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
        }`}>
          <div className={`absolute inset-0 rounded-full animate-ping ${
            isDark ? 'bg-cyan-500/30' : 'bg-cyan-400/30'
          }`} />
          <Upload className={`w-12 h-12 z-10 animate-pulse ${
            isDark ? 'text-cyan-400' : 'text-cyan-600'
          }`} />
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className={`p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
        }`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
              Chunks Uploaded
            </span>
            <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
              {uploadedChunks}/{totalChunks}
            </span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${
            isDark ? 'bg-white/10' : 'bg-cyan-100'
          }`}>
            <div
              className={`h-full transition-all duration-300 ${
                isDark
                  ? 'bg-linear-to-r from-cyan-500 to-blue-500'
                  : 'bg-linear-to-r from-cyan-400 to-blue-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className={`p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
        }`}>
          <div className="flex justify-between items-center">
            <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
              Progress
            </span>
            <span className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
              {progress}%
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
        }`}>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Mode
              </span>
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                Parallel
              </span>
            </div>
            <div className="flex justify-between">
              <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Max Workers
              </span>
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                {currentProfile.workers}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Active Workers
              </span>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-bold ${
                  displayWorkers > maxWorkers 
                    ? 'text-red-500'  // Red if overflow (shouldn't happen)
                    : isDark ? 'text-cyan-400' : 'text-cyan-600'
                }`}>
                  {displayWorkers}
                </span>
                {displayWorkers > 0 && (
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    displayWorkers > maxWorkers
                      ? 'bg-red-500'  // Red indicator if overflow
                      : isDark ? 'bg-green-400' : 'bg-green-500'
                  }`} />
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Network
              </span>
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                {currentProfile.speed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Dots */}
      <div className="flex justify-center space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`}
            style={{
              animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SuccessState({ uploadTime, uploadedChunks, isDark }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
          isDark ? 'bg-green-500/20' : 'bg-green-100'
        }`}>
          <Check className={`w-12 h-12 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h3 className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
          Upload Complete!
        </h3>
        <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-600'}`}>
          Time: {uploadTime}
        </p>
        <p className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
          {uploadedChunks} chunks uploaded successfully
        </p>
      </div>
    </div>
  );
}

function IdleState({ isDark }: any) {
  return (
    <div className="space-y-4 text-center py-8">
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
        isDark ? 'bg-white/10' : 'bg-cyan-100'
      }`}>
        <Upload className={`w-10 h-10 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
      </div>
      <div>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-cyan-900'}`}>
          Ready to Upload
        </h3>
        <p className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
          Select a file to start
        </p>
      </div>
      <div className={`p-4 rounded-xl backdrop-blur-sm border ${
        isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
      }`}>
        <div className="space-y-2 text-left text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`} />
            <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
              Chunked upload with resume
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`} />
            <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
              xxHash integrity checks
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`} />
            <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
              Network adaptive streaming
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
