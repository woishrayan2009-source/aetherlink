import { UploadMetrics } from "./UploadMetrics";

export interface ChunkLatencyPoint {
  timestamp: number;
  chunkIndex: number;
  latency: number;
  workerId?: number;
  retryCount: number;
}

export interface ConcurrencySnapshot {
  timestamp: number;
  concurrency: number;
  reason?: string;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface RetryDataPoint {
  chunkIndex: number;
  retryCount: number;
  totalDuration: number;
  errors: string[];
}

export interface NetworkStatusSnapshot {
  timestamp: number;
  downlink?: number; // Mbps
  effectiveType?: string; // '4g', '3g', '2g', 'slow-2g'
  rtt?: number; // Round trip time in ms
  saveData?: boolean;
}

export interface TimelineSegment {
  type: 'stable' | 'degraded' | 'retrying' | 'throttled';
  startTime: number;
  endTime: number;
  duration: number;
  concurrency: number;
}

export interface WorkerEfficiencySnapshot {
  timestamp: number;
  activeWorkers: number;
  totalWorkers: number;
  efficiency: number; // 0-100%
  idleTime: number;
}

export interface TelemetryMetrics extends UploadMetrics {
  // Latency tracking
  latencyPoints: ChunkLatencyPoint[];
  averageLatency: number;
  peakLatency: number;
  latencyVariance: number;
  
  // Concurrency tracking
  concurrencyHistory: ConcurrencySnapshot[];
  currentConcurrency: number;
  peakConcurrency: number;
  concurrencyDrops: number;
  
  // Worker efficiency
  workerEfficiency: WorkerEfficiencySnapshot[];
  currentEfficiency: number;
  averageEfficiency: number;
  
  // Retry tracking
  retryHeatmap: RetryDataPoint[];
  totalRetries: number;
  retriesPerChunk: number;
  
  // Network tracking
  networkHistory: NetworkStatusSnapshot[];
  networkDegradations: number;
  networkRecoveries: number;
  
  // Timeline
  timeline: TimelineSegment[];
  stableTime: number;
  degradedTime: number;
  retryingTime: number;
  throttledTime: number;
  
  // Performance score
  performanceScore: number;
  throughput: number; // chunks per second
  jitter: number; // latency variance indicator
  adaptiveImprovement: number; // % improvement vs static mode
  
  // Real-time indicators
  isNetworkDegraded: boolean;
  lastConcurrencyChange?: {
    timestamp: number;
    from: number;
    to: number;
    reason: string;
  };
}

export const createEmptyTelemetry = (): TelemetryMetrics => ({
  // Base metrics
  successfulChunks: 0,
  failedRetries: 0,
  startTime: 0,
  bandwidth: 0,
  totalBytes: 0,
  wastedBytes: 0,
  
  // Latency
  latencyPoints: [],
  averageLatency: 0,
  peakLatency: 0,
  latencyVariance: 0,
  
  // Concurrency
  concurrencyHistory: [],
  currentConcurrency: 10,
  peakConcurrency: 10,
  concurrencyDrops: 0,
  
  // Worker efficiency
  workerEfficiency: [],
  currentEfficiency: 0,
  averageEfficiency: 0,
  
  // Retry tracking
  retryHeatmap: [],
  totalRetries: 0,
  retriesPerChunk: 0,
  
  // Network
  networkHistory: [],
  networkDegradations: 0,
  networkRecoveries: 0,
  
  // Timeline
  timeline: [],
  stableTime: 0,
  degradedTime: 0,
  retryingTime: 0,
  throttledTime: 0,
  
  // Performance
  performanceScore: 0,
  throughput: 0,
  jitter: 0,
  adaptiveImprovement: 0,
  
  // Real-time
  isNetworkDegraded: false,
});
