"use client";
import { Zap } from "lucide-react";

interface ParallelToggleProps {
  parallel: boolean;
  workers: number;
  onToggle: () => void;
  isDark: boolean;
}

export function ParallelToggle({ parallel, workers, onToggle, isDark }: ParallelToggleProps) {
  return (
    <div className={`flex items-center justify-between p-4 backdrop-blur-xl rounded-xl border transition-all duration-300 ${
      isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
    }`}>
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 backdrop-blur-sm rounded-lg flex items-center justify-center border transition-all duration-300 ${
          isDark ? 'bg-cyan-500/20 border-cyan-400/30' : 'bg-cyan-100 border-cyan-300'
        }`}>
          <Zap className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
        </div>
        <div>
          <p className={`font-medium text-sm transition-colors duration-300 ${
            isDark ? 'text-white' : 'text-cyan-900'
          }`}>Parallel Upload</p>
          <p className={`text-xs transition-colors duration-300 ${
            isDark ? 'text-cyan-300' : 'text-cyan-600'
          }`}>Workers: {workers}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-all duration-300 backdrop-blur-sm border ${
          parallel
            ? isDark
              ? "bg-cyan-500/80 border-cyan-400/50"
              : "bg-cyan-500 border-cyan-600"
            : isDark
              ? "bg-white/10 border-white/20"
              : "bg-gray-200 border-gray-300"
        }`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${
          parallel ? "transform translate-x-6" : ""
        }`} />
      </button>
    </div>
  );
}
