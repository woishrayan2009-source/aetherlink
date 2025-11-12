"use client";
import { ChunkVisualizer } from "../ChunkVisualizer";

interface ProgressDisplayProps {
  progress: number;
  totalChunks: number;
  uploadedChunks: number;
  isDark: boolean;
}

export function ProgressDisplay({ progress, totalChunks, uploadedChunks, isDark }: ProgressDisplayProps) {
  return (
    <div className="space-y-4">
      <ChunkVisualizer progress={progress} totalChunks={totalChunks} uploadedChunks={uploadedChunks} />

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={`transition-colors duration-300 ${
            isDark ? 'text-cyan-300' : 'text-cyan-700'
          }`}>Progress</span>
          <span className={`font-semibold transition-colors duration-300 ${
            isDark ? 'text-cyan-400' : 'text-cyan-600'
          }`}>{progress}%</span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden backdrop-blur-sm transition-all duration-300 ${
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
    </div>
  );
}
