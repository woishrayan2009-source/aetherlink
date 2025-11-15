import { useEffect, useState, useRef, useCallback } from 'react';

export interface NetworkSpeed {
    downloadSpeed: number;
    latency: number; // in ms
    effectiveType: string;
    timestamp: number;
}

export interface AdaptiveChunkConfig {
    chunkSize: number; // in bytes
    workers: number;
    batchSize: number;
}

function calculateOptimalChunkSize(speed: NetworkSpeed): AdaptiveChunkConfig {
    const { downloadSpeed, latency, effectiveType } = speed;

    if (effectiveType === 'slow-2g' || downloadSpeed < 0.1) {
        return {
            chunkSize: 5 * 1024,
            workers: 1,
            batchSize: 1
        };
    } else if (effectiveType === '2g' || downloadSpeed < 0.3) {
        return {
            chunkSize: 32 * 1024,
            workers: 1,
            batchSize: 2
        };
    } else if (effectiveType === '3g' || downloadSpeed < 1) {
        return {
            chunkSize: 256 * 1024,
            workers: 2,
            batchSize: 3
        };
    } else if (downloadSpeed < 5) {
        return {
            chunkSize: 1 * 1024 * 1024,
            workers: 3,
            batchSize: 4
        };
    } else if (downloadSpeed < 10) {
        return {
            chunkSize: 2 * 1024 * 1024,
            workers: 15,
            batchSize: 6
        };
    } else if (downloadSpeed < 25) {
        return {
            chunkSize: 5 * 1024 * 1024,
            workers: 20,
            batchSize: 8
        };
    } else if (downloadSpeed < 50) {
        return {
            chunkSize: 8 * 1024 * 1024,
            workers: 30,
            batchSize: 10
        };
    } else {
        // High-speed connection (50+ Mbps)
        return {
            chunkSize: 10 * 1024 * 1024,
            workers: 40,
            batchSize: 12
        };
    }
}

async function measureNetworkSpeed(): Promise<NetworkSpeed> {
    const connection = (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

    let downloadSpeed = 10; // Default 10 Mbps
    let latency = 50; // Default 50ms
    let effectiveType = '4g';

    if (connection) {
        effectiveType = connection.effectiveType || '4g';
        downloadSpeed = connection.downlink || 10;
        latency = connection.rtt || 50;
    }

    return {
        downloadSpeed,
        latency,
        effectiveType,
        timestamp: Date.now()
    };
}

async function performSpeedTest(): Promise<number> {
    try {
        const testSize = 50 * 1024; // 50KB test
        const startTime = performance.now();

        // Use a tiny image or create a small blob for testing
        const testBlob = new Blob([new Uint8Array(testSize)]);
        const url = URL.createObjectURL(testBlob);

        await fetch(url);
        URL.revokeObjectURL(url);

        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000; // in seconds
        const speedMbps = (testSize * 8) / (duration * 1_000_000); // Convert to Mbps

        return Math.max(0.1, speedMbps);
    } catch (error) {
        console.warn('Speed test failed, using default:', error);
        return 10; 
    }
}

export function useNetworkSpeedMonitor(intervalMs: number = 1000) {
    const [networkSpeed, setNetworkSpeed] = useState<NetworkSpeed>({
        downloadSpeed: 10,
        latency: 50,
        effectiveType: '4g',
        timestamp: new Date().getTime()
    });

    const [chunkConfig, setChunkConfig] = useState<AdaptiveChunkConfig>({
        chunkSize: 10 * 1024 * 1024,
        workers: 40,
        batchSize: 6
    });

    const [isMonitoring, setIsMonitoring] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateRef = useRef<number>(new Date().getTime());
    const speedHistoryRef = useRef<number[]>([]);

    // Smoothing function to avoid rapid changes
    const smoothSpeed = useCallback((newSpeed: number): number => {
        speedHistoryRef.current.push(newSpeed);

        // Keep only last 5 measurements
        if (speedHistoryRef.current.length > 5) {
            speedHistoryRef.current.shift();
        }

        // Calculate moving average
        const avg = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
        return avg;
    }, []);

    // Update network speed and chunk configuration
    const updateNetworkInfo = useCallback(async () => {
        try {
            const speed = await measureNetworkSpeed();

            // Smooth the speed measurement
            const smoothedSpeed = smoothSpeed(speed.downloadSpeed);

            const updatedSpeed: NetworkSpeed = {
                ...speed,
                downloadSpeed: smoothedSpeed
            };

            setNetworkSpeed(updatedSpeed);

            // Only update chunk config if speed changed significantly (>20%)
            const currentSpeed = networkSpeed.downloadSpeed;
            const speedDiff = Math.abs(smoothedSpeed - currentSpeed) / currentSpeed;

            if (speedDiff > 0.2 || Date.now() - lastUpdateRef.current > 5000) {
                const newConfig = calculateOptimalChunkSize(updatedSpeed);
                setChunkConfig(newConfig);
                lastUpdateRef.current = Date.now();
            }
        } catch (error) {
            console.error('Network monitoring error:', error);
        }
    }, [networkSpeed.downloadSpeed, smoothSpeed]);

    // Start/stop monitoring
    useEffect(() => {
        if (!isMonitoring) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Initial measurement
        // Defer initial measurement to avoid synchronous setState inside the effect
        setTimeout(() => {
            updateNetworkInfo();
        }, 0);

        // Set up interval for continuous monitoring
        intervalRef.current = setInterval(() => {
            // Use requestIdleCallback if available for better performance
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    updateNetworkInfo();
                }, { timeout: intervalMs });
            } else {
                updateNetworkInfo();
            }
        }, intervalMs);

        // Listen to connection changes for immediate updates
        const connection = (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection;

        if (connection) {
            connection.addEventListener('change', updateNetworkInfo);
        }

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (connection) {
                connection.removeEventListener('change', updateNetworkInfo);
            }
        };
    }, [isMonitoring, intervalMs, updateNetworkInfo]);

    // Control functions
    const pause = useCallback(() => setIsMonitoring(false), []);
    const resume = useCallback(() => setIsMonitoring(true), []);
    const forceUpdate = useCallback(() => updateNetworkInfo(), [updateNetworkInfo]);

    return {
        networkSpeed,
        chunkConfig,
        isMonitoring,
        pause,
        resume,
        forceUpdate
    };
}
