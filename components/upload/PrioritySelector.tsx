"use client";
import { Priority } from "@/types/UploadMetrics";

interface PrioritySelectorProps {
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  isUploading: boolean;
  isDark: boolean;
}

export function PrioritySelector({ priority, onPriorityChange, isUploading, isDark }: PrioritySelectorProps) {
  const priorities: Priority[] = ['high', 'medium', 'low'];

  const getPriorityDescription = (p: Priority) => {
    switch (p) {
      case 'high': return '⚡ Fastest processing, higher cost';
      case 'medium': return '📊 Balanced speed and cost';
      case 'low': return '💰 Cost-efficient, longer queue time';
    }
  };

  return (
    <div className={`backdrop-blur-xl rounded-xl border p-4 transition-all duration-300 ${
      isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
    }`}>
      <label className={`block text-sm font-medium mb-3 transition-colors duration-300 ${
        isDark ? 'text-cyan-300' : 'text-cyan-700'
      }`}>
        Upload Priority
      </label>
      <div className="grid grid-cols-3 gap-2">
        {priorities.map((p) => (
          <button
            key={p}
            onClick={() => onPriorityChange(p)}
            disabled={isUploading}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              priority === p
                ? p === 'high'
                  ? isDark ? 'bg-red-500/30 border-2 border-red-400 text-red-300' : 'bg-red-100 border-2 border-red-500 text-red-700'
                  : p === 'medium'
                  ? isDark ? 'bg-yellow-500/30 border-2 border-yellow-400 text-yellow-300' : 'bg-yellow-100 border-2 border-yellow-500 text-yellow-700'
                  : isDark ? 'bg-green-500/30 border-2 border-green-400 text-green-300' : 'bg-green-100 border-2 border-green-500 text-green-700'
                : isDark
                ? 'bg-white/5 border border-white/20 text-white hover:bg-white/10'
                : 'bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <p className={`text-xs mt-2 ${isDark ? 'text-cyan-300/70' : 'text-cyan-600'}`}>
        {getPriorityDescription(priority)}
      </p>
    </div>
  );
}
