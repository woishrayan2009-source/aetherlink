// Network Monitoring Web Worker
// Runs in background without blocking main thread

let monitoringInterval = null;
let isMonitoring = false;
let lastMeasurement = {
  timestamp: Date.now(),
  speed: 0,
  latency: 0,
  jitter: 0,
};

// Lightweight network speed test
async function measureNetworkSpeed() {
  const testUrl = 'https://www.google.com/favicon.ico?' + Date.now();
  const startTime = performance.now();
  
  try {
    const response = await fetch(testUrl, {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors', // Avoid CORS issues
    });
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Calculate jitter (variance in latency)
    const jitter = Math.abs(latency - lastMeasurement.latency);
    
    return {
      latency,
      jitter,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      latency: 999,
      jitter: 0,
      timestamp: Date.now(),
      error: error.message,
    };
  }
}

// Use Network Information API if available
function getConnectionInfo() {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData,
      };
    }
  }
  return null;
}

// Calculate optimal chunk size based on network metrics
function calculateOptimalChunkSize(metrics) {
  const { effectiveType, downlink, latency, jitter } = metrics;
  
  // Base chunk sizes by network type
  let baseChunkSize;
  
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    baseChunkSize = 5 * 1024; // 5KB
  } else if (effectiveType === '3g') {
    baseChunkSize = 512 * 1024; // 512KB
  } else if (effectiveType === '4g') {
    baseChunkSize = 2 * 1024 * 1024; // 2MB
  } else {
    // Default or 5G
    baseChunkSize = 10 * 1024 * 1024; // 10MB
  }
  
  // Adjust based on downlink speed (Mbps)
  if (downlink) {
    if (downlink < 1) {
      baseChunkSize = Math.min(baseChunkSize, 100 * 1024); // Max 100KB
    } else if (downlink < 5) {
      baseChunkSize = Math.min(baseChunkSize, 1 * 1024 * 1024); // Max 1MB
    } else if (downlink < 10) {
      baseChunkSize = Math.min(baseChunkSize, 3 * 1024 * 1024); // Max 3MB
    } else if (downlink >= 50) {
      baseChunkSize = Math.max(baseChunkSize, 15 * 1024 * 1024); // Min 15MB for very fast
    }
  }
  
  // Adjust for high latency or jitter
  if (latency > 500 || jitter > 200) {
    baseChunkSize = Math.floor(baseChunkSize * 0.7); // Reduce by 30%
  } else if (latency > 200 || jitter > 100) {
    baseChunkSize = Math.floor(baseChunkSize * 0.85); // Reduce by 15%
  }
  
  // Ensure minimum and maximum bounds
  const MIN_CHUNK = 5 * 1024; // 5KB minimum
  const MAX_CHUNK = 20 * 1024 * 1024; // 20MB maximum
  
  return Math.max(MIN_CHUNK, Math.min(MAX_CHUNK, baseChunkSize));
}

// Calculate optimal worker count
function calculateOptimalWorkers(metrics) {
  const { effectiveType, downlink, latency } = metrics;
  
  // Poor connections need fewer workers
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 1;
  } else if (effectiveType === '3g' || latency > 300) {
    return 2;
  } else if (effectiveType === '4g' && downlink < 5) {
    return 3;
  } else if (downlink >= 50) {
    return 8; // High-speed connections can handle more
  } else {
    return 4; // Default
  }
}

// Main monitoring loop
async function monitorNetwork() {
  const connectionInfo = getConnectionInfo();
  const speedTest = await measureNetworkSpeed();
  
  const metrics = {
    effectiveType: connectionInfo?.effectiveType || 'unknown',
    downlink: connectionInfo?.downlink || 0,
    rtt: connectionInfo?.rtt || speedTest.latency,
    latency: speedTest.latency,
    jitter: speedTest.jitter,
    saveData: connectionInfo?.saveData || false,
    timestamp: speedTest.timestamp,
  };
  
  const chunkSize = calculateOptimalChunkSize(metrics);
  const workers = calculateOptimalWorkers(metrics);
  
  // Store for jitter calculation
  lastMeasurement = {
    timestamp: metrics.timestamp,
    speed: metrics.downlink,
    latency: metrics.latency,
    jitter: metrics.jitter,
  };
  
  // Send update to main thread
  self.postMessage({
    type: 'update',
    data: {
      metrics,
      chunkSize,
      workers,
      networkType: metrics.effectiveType,
      quality: getNetworkQuality(metrics),
    },
  });
}

// Determine network quality
function getNetworkQuality(metrics) {
  const { effectiveType, downlink, latency, jitter } = metrics;
  
  if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1 || latency > 500) {
    return 'poor';
  } else if (effectiveType === '3g' || downlink < 5 || latency > 200 || jitter > 150) {
    return 'fair';
  } else if (effectiveType === '4g' || downlink < 20 || latency > 100) {
    return 'good';
  } else {
    return 'excellent';
  }
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, interval } = event.data;
  
  switch (type) {
    case 'start':
      if (!isMonitoring) {
        isMonitoring = true;
        const monitorInterval = interval || 1000; // Default 1 second
        
        // Initial measurement
        await monitorNetwork();
        
        // Set up periodic monitoring
        monitoringInterval = setInterval(async () => {
          await monitorNetwork();
        }, monitorInterval);
        
        self.postMessage({ type: 'started' });
      }
      break;
      
    case 'stop':
      if (isMonitoring) {
        isMonitoring = false;
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          monitoringInterval = null;
        }
        self.postMessage({ type: 'stopped' });
      }
      break;
      
    case 'measure':
      // One-time measurement
      await monitorNetwork();
      break;
      
    default:
      break;
  }
});

// Handle worker errors
self.addEventListener('error', (error) => {
  self.postMessage({
    type: 'error',
    error: error.message,
  });
});
