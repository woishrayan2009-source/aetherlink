"use client";
import { TelemetryMetrics } from '@/types/TelemetryMetrics';
import { LatencyChart } from './LatencyChart';
import { ConcurrencyDynamics } from './ConcurrencyDynamics';
import { WorkerEfficiencyGauge } from './WorkerEfficiencyGauge';
import { RetryHeatmap } from './RetryHeatmap';
import { NetworkProfileCard } from './NetworkProfileCard';
import { PerformanceScore } from './PerformanceScore';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TelemetryDashboardProps {
  telemetry: TelemetryMetrics;
  totalChunks: number;
  isDark: boolean;
  isUploading: boolean;
}

export function TelemetryDashboard({
  telemetry,
  totalChunks,
  isDark,
  isUploading,
}: TelemetryDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const hasData = telemetry.latencyPoints.length > 0 || telemetry.concurrencyHistory.length > 0;
  
  return (
    <div className={`backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300 ${
      isDark
        ? 'bg-linear-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30'
        : 'bg-linear-to-br from-blue-50 to-purple-50 border-blue-300'
    }`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
            }`}>
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                Performance Telemetry
              </h3>
              <p className={`text-sm ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
                Real-time adaptive intelligence monitoring
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-lg transition-all duration-300 ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-cyan-100'
            }`}
            aria-label={isExpanded ? 'Collapse telemetry' : 'Expand telemetry'}
          >
            {isExpanded ? (
              <ChevronUp className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            )}
          </button>
        </div>
        
        {/* Quick Stats */}
        {isExpanded && hasData && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className={`p-3 rounded-lg text-center ${
              isDark ? 'bg-white/5' : 'bg-white/60'
            }`}>
              <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
                Avg Latency
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {telemetry.averageLatency.toFixed(0)}ms
              </div>
            </div>
            
            <div className={`p-3 rounded-lg text-center ${
              isDark ? 'bg-white/5' : 'bg-white/60'
            }`}>
              <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
                Workers
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {telemetry.currentConcurrency}
              </div>
            </div>
            
            <div className={`p-3 rounded-lg text-center ${
              isDark ? 'bg-white/5' : 'bg-white/60'
            }`}>
              <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
                Efficiency
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {telemetry.currentEfficiency.toFixed(0)}%
              </div>
            </div>
            
            <div className={`p-3 rounded-lg text-center ${
              isDark ? 'bg-white/5' : 'bg-white/60'
            }`}>
              <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
                Throughput
              </div>
              <div className={`text-lg font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {telemetry.throughput.toFixed(1)}/s
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      {isExpanded && (
        <div className="p-6">
          {!hasData && !isUploading ? (
            <div className={`text-center py-12 ${isDark ? 'text-white/40' : 'text-cyan-600/40'}`}>
              <div className="text-6xl mb-4">📈</div>
              <p className="text-lg font-semibold mb-2">Ready to Track Performance</p>
              <p className="text-sm">
                Start an upload to see real-time adaptive intelligence metrics
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top Row - Performance Score (Hero) */}
              <div className="mb-2">
                <PerformanceScore
                  performanceScore={telemetry.performanceScore}
                  throughput={telemetry.throughput}
                  adaptiveImprovement={telemetry.adaptiveImprovement}
                  averageEfficiency={telemetry.averageEfficiency}
                  retriesPerChunk={telemetry.retriesPerChunk}
                  isDark={isDark}
                />
              </div>
              
              {/* Second Row - Key Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LatencyChart
                  latencyPoints={telemetry.latencyPoints}
                  isDark={isDark}
                />
                
                <ConcurrencyDynamics
                  concurrencyHistory={telemetry.concurrencyHistory}
                  currentConcurrency={telemetry.currentConcurrency}
                  peakConcurrency={telemetry.peakConcurrency}
                  concurrencyDrops={telemetry.concurrencyDrops}
                  isDark={isDark}
                />
              </div>
              
              {/* Third Row - Worker & Network */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WorkerEfficiencyGauge
                  currentEfficiency={telemetry.currentEfficiency}
                  averageEfficiency={telemetry.averageEfficiency}
                  activeWorkers={telemetry.workerEfficiency[telemetry.workerEfficiency.length - 1]?.activeWorkers || 0}
                  totalWorkers={telemetry.currentConcurrency}
                  isNetworkDegraded={telemetry.isNetworkDegraded}
                  isDark={isDark}
                />
                
                <NetworkProfileCard
                  networkHistory={telemetry.networkHistory}
                  isNetworkDegraded={telemetry.isNetworkDegraded}
                  currentConcurrency={telemetry.currentConcurrency}
                  isDark={isDark}
                />
              </div>
              
              {/* Fourth Row - Retry Heatmap */}
              <div>
                <RetryHeatmap
                  retryHeatmap={telemetry.retryHeatmap}
                  totalChunks={totalChunks}
                  isDark={isDark}
                />
              </div>
              
              {/* Last Change Indicator */}
              {telemetry.lastConcurrencyChange && (
                <div className={`p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-bottom duration-300 ${
                  isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-300'
                }`}>
                  <div className="text-2xl">⚡</div>
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                      Latest Adjustment
                    </div>
                    <div className={`text-xs ${isDark ? 'text-white/70' : 'text-cyan-700/70'}`}>
                      Concurrency: {telemetry.lastConcurrencyChange.from} → {telemetry.lastConcurrencyChange.to} workers
                    </div>
                    <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
                      {telemetry.lastConcurrencyChange.reason}
                    </div>
                  </div>
                  <div className={`text-xs ${isDark ? 'text-white/40' : 'text-cyan-600/40'}`}>
                    {new Date(telemetry.lastConcurrencyChange.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
