"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CostComparison as CostComparisonType, UploadMetrics } from "@/types/UploadMetrics";

interface CostComparisonProps {
  costComparison: CostComparisonType;
  metrics: UploadMetrics;
  totalChunks: number;
  isDark: boolean;
}

export function CostComparison({ costComparison, metrics, totalChunks, isDark }: CostComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Calculate success rate percentage
  const successRate = totalChunks > 0 ? ((metrics.successfulChunks / totalChunks) * 100) : 0;
  const failureRate = totalChunks > 0 ? ((metrics.failedRetries / (metrics.successfulChunks + metrics.failedRetries)) * 100) : 0;

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${
      isDark
        ? 'bg-linear-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30'
        : 'bg-linear-to-br from-blue-50 to-purple-50 border-blue-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            📊 Upload Metrics
          </h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-2 rounded-lg transition-all duration-300 ${
            isDark ? 'hover:bg-white/10' : 'hover:bg-cyan-100'
          }`}
          aria-label={isExpanded ? 'Collapse metrics' : 'Expand metrics'}
        >
          {isExpanded ? (
            <ChevronUp className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
          )}
        </button>
      </div>

      {isExpanded && (
        <>
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/60'}`}>
          <p className={`text-xs ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Success Rate</p>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {successRate.toFixed(1)}%
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
            ✅ {metrics.successfulChunks}/{totalChunks} chunks
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/60'}`}>
          <p className={`text-xs ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Failed Retries</p>
          <p className={`text-lg font-bold ${
            metrics.failedRetries > 0 
              ? isDark ? 'text-yellow-400' : 'text-yellow-600'
              : isDark ? 'text-white' : 'text-cyan-900'
          }`}>
            {metrics.failedRetries}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
            {failureRate > 0 ? `⚠️ ${failureRate.toFixed(1)}% failure rate` : '✨ No failures'}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/60'}`}>
          <p className={`text-xs ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Avg. Bandwidth</p>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {metrics.bandwidth.toFixed(2)} MB/s
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
            ⚡ Real-time speed
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/60'}`}>
          <p className={`text-xs ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Total Bytes</p>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {(metrics.totalBytes / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
            📦 Uploaded
          </p>
        </div>
      </div>

      {/* Wasted Data Section */}
      {metrics.wastedBytes > 0 && (
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                💾 Wasted Data from Retries
              </p>
              <p className={`text-xs ${isDark ? 'text-yellow-300/70' : 'text-yellow-600'}`}>
                Data re-transmitted due to failures
              </p>
            </div>
            <span className={`text-xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
              {(metrics.wastedBytes / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
