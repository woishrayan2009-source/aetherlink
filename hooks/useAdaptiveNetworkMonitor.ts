import { useState, useEffect, useRef, useCallback } from 'react';
import { NetworkProfile, NETWORK_PROFILES } from '@/types/NetworkProfile';

export interface NetworkMetrics {
  effectiveType: string;
  downlink: number;
  rtt: number;
  latency: number;
  jitter: number;
  saveData: boolean;
  timestamp: number;
}

export interface AdaptiveNetworkState {
  metrics: NetworkMetrics;
  chunkSize: number;
  workers: number;
  networkType: string;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  isMonitoring: boolean;
  adaptiveProfile: NetworkProfile;
}

interface WorkerMessage {
  type: 'update' | 'started' | 'stopped' | 'error';
  data?: {
    metrics: NetworkMetrics;
    chunkSize: number;
    workers: number;
    networkType: string;
    quality: 'poor' | 'fair' | 'good' | 'excellent';
  };
  error?: string;
}

const DEFAULT_METRICS: NetworkMetrics = {
  effectiveType: 'unknown',
  downlink: 0,
  rtt: 0,
  latency: 0,
  jitter: 0,
  saveData: false,
  timestamp: Date.now(),
};

export function useAdaptiveNetworkMonitor(
  enabled: boolean = true,
  interval: number = 1000 // Monitor every second
) {
  const [state, setState] = useState<AdaptiveNetworkState>({
    metrics: DEFAULT_METRICS,
    chunkSize: 10 * 1024 * 1024,
    workers: 40,
    networkType: 'unknown',
    quality: 'good',
    isMonitoring: false,
    adaptiveProfile: NETWORK_PROFILES.normal,
  });

  const workerRef = useRef<Worker | null>(null);
  const mountedRef = useRef(true);

  // Create adaptive network profile based on current metrics
  const createAdaptiveProfile = useCallback((
    chunkSize: number,
    workers: number,
    quality: string,
    networkType: string
  ): NetworkProfile => {
    // Map quality to delay and failure rate
    let delay = 0;
    let failureRate = 0;
    let color = 'green';

    switch (quality) {
      case 'poor':
        delay = 1500;
        failureRate = 30;
        color = 'red';
        break;
      case 'fair':
        delay = 500;
        failureRate = 15;
        color = 'yellow';
        break;
      case 'good':
        delay = 100;
        failureRate = 5;
        color = 'green';
        break;
      case 'excellent':
        delay = 0;
        failureRate = 0;
        color = 'green';
        break;
    }

    // Cap workers at 40 for excellent quality
    const cappedWorkers = Math.min(workers, 40);

    return {
      name: 'adaptive',
      label: `Adaptive (${networkType})`,
      chunkSize,
      workers: cappedWorkers,
      delay,
      failureRate,
      color,
      speed: networkType,
    };
  }, []);

  // Initialize Web Worker
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && typeof Worker !== 'undefined') {
      try {
        workerRef.current = new Worker('/network-monitor.worker.js');

        workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
          if (!mountedRef.current) return;

          const { type, data, error } = event.data;

          switch (type) {
            case 'update':
              if (data) {
                const adaptiveProfile = createAdaptiveProfile(
                  data.chunkSize,
                  data.workers,
                  data.quality,
                  data.networkType
                );

                setState(prev => ({
                  ...prev,
                  metrics: data.metrics,
                  chunkSize: data.chunkSize,
                  workers: data.workers,
                  networkType: data.networkType,
                  quality: data.quality,
                  adaptiveProfile,
                }));
              }
              break;

            case 'started':
              setState(prev => ({ ...prev, isMonitoring: true }));
              break;

            case 'stopped':
              setState(prev => ({ ...prev, isMonitoring: false }));
              break;

            case 'error':
              console.error('Network monitor worker error:', error);
              break;
          }
        };

        workerRef.current.onerror = (error) => {
          console.error('Network monitor worker error:', error);
        };

        // Start monitoring
        workerRef.current.postMessage({ type: 'start', interval });

      } catch (error) {
        console.error('Failed to initialize network monitor worker:', error);
      }
    }

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'stop' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [enabled, interval, createAdaptiveProfile]);

  // Manual trigger for immediate measurement
  const measureNow = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'measure' });
    }
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (workerRef.current && !state.isMonitoring) {
      workerRef.current.postMessage({ type: 'start', interval });
    }
  }, [interval, state.isMonitoring]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (workerRef.current && state.isMonitoring) {
      workerRef.current.postMessage({ type: 'stop' });
    }
  }, [state.isMonitoring]);

  return {
    ...state,
    measureNow,
    startMonitoring,
    stopMonitoring,
  };
}
