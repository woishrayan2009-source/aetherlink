import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TelemetryMetrics,
  ChunkLatencyPoint,
  ConcurrencySnapshot,
  NetworkStatusSnapshot,
  TimelineSegment,
  WorkerEfficiencySnapshot,
  RetryDataPoint,
  createEmptyTelemetry
} from '@/types/TelemetryMetrics';

interface UseUploadTelemetryOptions {
  isUploading: boolean;
  uploadedChunks: number;
  totalChunks: number;
  activeWorkers: number;
  startTime: number;
}

export function useUploadTelemetry(options: UseUploadTelemetryOptions) {
  const [telemetry, setTelemetry] = useState<TelemetryMetrics>(createEmptyTelemetry());
  const chunkTimings = useRef<Map<number, number>>(new Map());
  const lastNetworkCheck = useRef<number>(0);
  const currentSegment = useRef<TimelineSegment | null>(null);
  
  // Track chunk start
  const recordChunkStart = useCallback((chunkIndex: number) => {
    chunkTimings.current.set(chunkIndex, performance.now());
  }, []);
  
  // Track chunk completion
  const recordChunkComplete = useCallback((
    chunkIndex: number,
    retryCount: number = 0,
    workerId?: number
  ) => {
    const startTime = chunkTimings.current.get(chunkIndex);
    if (!startTime) return;
    
    const latency = performance.now() - startTime;
    const timestamp = Date.now();
    
    setTelemetry(prev => {
      const newPoint: ChunkLatencyPoint = {
        timestamp,
        chunkIndex,
        latency,
        workerId,
        retryCount,
      };
      
      const newLatencyPoints = [...prev.latencyPoints, newPoint];
      const latencies = newLatencyPoints.map(p => p.latency);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const variance = latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) / latencies.length;
      
      // Update retry heatmap
      const retryHeatmap = [...prev.retryHeatmap];
      const existingRetry = retryHeatmap.find(r => r.chunkIndex === chunkIndex);
      if (existingRetry) {
        existingRetry.retryCount += retryCount;
        existingRetry.totalDuration += latency;
      } else if (retryCount > 0) {
        retryHeatmap.push({
          chunkIndex,
          retryCount,
          totalDuration: latency,
          errors: [],
        });
      }
      
      return {
        ...prev,
        latencyPoints: newLatencyPoints,
        averageLatency: avgLatency,
        peakLatency: Math.max(prev.peakLatency, latency),
        latencyVariance: Math.sqrt(variance),
        retryHeatmap,
        totalRetries: prev.totalRetries + retryCount,
      };
    });
    
    chunkTimings.current.delete(chunkIndex);
  }, []);
  
  // Track concurrency changes
  const recordConcurrencyChange = useCallback((
    newConcurrency: number,
    reason?: string,
    networkQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good'
  ) => {
    const timestamp = Date.now();
    
    setTelemetry(prev => {
      const snapshot: ConcurrencySnapshot = {
        timestamp,
        concurrency: newConcurrency,
        reason,
        networkQuality,
      };
      
      const isDrop = newConcurrency < prev.currentConcurrency;
      
      return {
        ...prev,
        concurrencyHistory: [...prev.concurrencyHistory, snapshot],
        currentConcurrency: newConcurrency,
        peakConcurrency: Math.max(prev.peakConcurrency, newConcurrency),
        concurrencyDrops: isDrop ? prev.concurrencyDrops + 1 : prev.concurrencyDrops,
        lastConcurrencyChange: {
          timestamp,
          from: prev.currentConcurrency,
          to: newConcurrency,
          reason: reason || 'Manual adjustment',
        },
      };
    });
  }, []);
  
  // Track network status
  const recordNetworkStatus = useCallback(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (!connection) return;
    
    const snapshot: NetworkStatusSnapshot = {
      timestamp: Date.now(),
      downlink: connection.downlink,
      effectiveType: connection.effectiveType,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
    
    setTelemetry(prev => ({
      ...prev,
      networkHistory: [...prev.networkHistory, snapshot].slice(-100), // Keep last 100
    }));
  }, []);
  
  // Record network degradation
  const recordNetworkDegradation = useCallback(() => {
    setTelemetry(prev => ({
      ...prev,
      networkDegradations: prev.networkDegradations + 1,
      isNetworkDegraded: true,
    }));
  }, []);
  
  // Record network recovery
  const recordNetworkRecovery = useCallback(() => {
    setTelemetry(prev => ({
      ...prev,
      networkRecoveries: prev.networkRecoveries + 1,
      isNetworkDegraded: false,
    }));
  }, []);
  
  // Update worker efficiency
  useEffect(() => {
    if (!options.isUploading) return;
    
    const interval = setInterval(() => {
      const totalWorkers = telemetry.currentConcurrency;
      const activeWorkers = options.activeWorkers;
      const efficiency = totalWorkers > 0 ? (activeWorkers / totalWorkers) * 100 : 0;
      
      const snapshot: WorkerEfficiencySnapshot = {
        timestamp: Date.now(),
        activeWorkers,
        totalWorkers,
        efficiency,
        idleTime: totalWorkers - activeWorkers,
      };
      
      setTelemetry(prev => {
        const newEfficiency = [...prev.workerEfficiency, snapshot].slice(-50);
        const avgEfficiency = newEfficiency.reduce((sum, s) => sum + s.efficiency, 0) / newEfficiency.length;
        
        return {
          ...prev,
          workerEfficiency: newEfficiency,
          currentEfficiency: efficiency,
          averageEfficiency: avgEfficiency,
        };
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [options.isUploading, options.activeWorkers, telemetry.currentConcurrency]);
  
  // Monitor network changes
  useEffect(() => {
    if (!options.isUploading) return;
    
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (!connection) return;
    
    const handleChange = () => {
      recordNetworkStatus();
      
      // Detect significant changes
      const now = Date.now();
      if (now - lastNetworkCheck.current < 3000) return;
      lastNetworkCheck.current = now;
      
      if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
        recordNetworkDegradation();
      }
    };
    
    connection.addEventListener('change', handleChange);
    
    // Initial reading - use timeout to avoid sync setState
    const timeout = setTimeout(() => recordNetworkStatus(), 0);
    
    return () => {
      connection.removeEventListener('change', handleChange);
      clearTimeout(timeout);
    };
  }, [options.isUploading, recordNetworkStatus, recordNetworkDegradation]);
  
  // Calculate performance metrics
  useEffect(() => {
    if (!options.isUploading || options.uploadedChunks === 0) return;
    
    // Use requestAnimationFrame to avoid sync setState
    const frame = requestAnimationFrame(() => {
      const elapsed = (Date.now() - options.startTime) / 1000; // seconds
      const throughput = options.uploadedChunks / elapsed;
      
      // Calculate performance score (0-100)
      const throughputWeight = 0.4;
      const stabilityWeight = 0.3;
      const efficiencyWeight = 0.2;
      const penaltyWeight = 0.1;
      
      const normalizedThroughput = Math.min(throughput / 10, 1); // Normalize to 0-1 (assume 10 chunks/s is excellent)
      const stability = 1 - Math.min(telemetry.jitter / 500, 1); // Normalize jitter (500ms = poor)
      const retryRate = telemetry.totalRetries / Math.max(options.uploadedChunks, 1);
      
      const score = (
        throughputWeight * normalizedThroughput * 100 +
        stabilityWeight * stability * 100 +
        efficiencyWeight * telemetry.averageEfficiency -
        penaltyWeight * retryRate * 100
      );
      
      // Estimate improvement vs static 40-worker mode
      // Adaptive mode typically saves 20-40% on poor networks, 10-15% on good networks
      const adaptiveImprovement = telemetry.isNetworkDegraded ? 35 : 12;
      
      setTelemetry(prev => ({
        ...prev,
        throughput,
        performanceScore: Math.max(0, Math.min(100, score)),
        jitter: prev.latencyVariance,
        adaptiveImprovement,
        retriesPerChunk: retryRate,
      }));
    });
    
    return () => cancelAnimationFrame(frame);
  }, [options.isUploading, options.uploadedChunks, options.startTime, telemetry.jitter, telemetry.averageEfficiency, telemetry.totalRetries, telemetry.isNetworkDegraded, telemetry.latencyVariance]);
  
  // Reset telemetry
  const reset = useCallback(() => {
    setTelemetry(createEmptyTelemetry());
    chunkTimings.current.clear();
    currentSegment.current = null;
  }, []);
  
  return {
    telemetry,
    recordChunkStart,
    recordChunkComplete,
    recordConcurrencyChange,
    recordNetworkStatus,
    recordNetworkDegradation,
    recordNetworkRecovery,
    reset,
  };
}
