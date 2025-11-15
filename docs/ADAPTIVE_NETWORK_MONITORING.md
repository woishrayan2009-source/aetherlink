# Adaptive Network Monitoring

## Overview

The Adaptive Network Monitoring feature continuously monitors network conditions and automatically adjusts upload chunk sizes and worker counts to optimize performance. It runs in a background Web Worker to avoid impacting application performance.

## Features

### 🚀 Real-time Network Monitoring
- Monitors network speed, latency, and jitter every second
- Uses the Network Information API when available
- Performs lightweight network tests without affecting upload speed
- Runs in a Web Worker for non-blocking operation

### 📊 Dynamic Chunk Size Optimization
Automatically adjusts chunk sizes based on:
- **Network Type**: 2G, 3G, 4G, 5G detection
- **Download Speed**: Mbps measurements
- **Latency**: Response time considerations
- **Jitter**: Network stability analysis

#### Chunk Size Ranges:
- **2G/Slow 2G**: 5 KB chunks
- **3G**: 512 KB chunks
- **4G**: 2-3 MB chunks
- **5G/High-speed**: 10-20 MB chunks

### 👥 Dynamic Worker Count
Adjusts parallel upload workers based on network quality:
- **Poor networks (2G)**: 1 worker
- **Fair networks (3G)**: 2 workers
- **Good networks (4G)**: 3-4 workers
- **Excellent networks (5G+)**: 8 workers

### 🎯 Network Quality Classification
- **Poor**: 2G, <1 Mbps, or >500ms latency
- **Fair**: 3G, 1-5 Mbps, or 200-500ms latency
- **Good**: 4G, 5-20 Mbps, or 100-200ms latency
- **Excellent**: 5G, >20 Mbps, <100ms latency

## Architecture

### Web Worker Implementation
```
┌─────────────────────────────────────────┐
│         Main Thread                     │
│  ┌────────────────────────────────┐    │
│  │   FileUpload Component         │    │
│  │   useAdaptiveNetworkMonitor    │    │
│  └────────────┬───────────────────┘    │
│               │ postMessage()           │
│               ↓                         │
└───────────────┼─────────────────────────┘
                │
┌───────────────┼─────────────────────────┐
│               ↓                         │
│  ┌────────────────────────────────┐    │
│  │   Web Worker                   │    │
│  │   network-monitor.worker.js    │    │
│  │                                │    │
│  │  • Network Information API     │    │
│  │  • Latency measurements        │    │
│  │  • Jitter calculations         │    │
│  │  • Chunk size optimization     │    │
│  └────────────┬───────────────────┘    │
│               │ postMessage()           │
│               ↓                         │
└───────────────┼─────────────────────────┘
                │
┌───────────────┼─────────────────────────┐
│               ↓                         │
│  ┌────────────────────────────────┐    │
│  │   NetworkMonitorDisplay        │    │
│  │   (UI Component)               │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Usage

### In FileUpload Component

```tsx
import { useAdaptiveNetworkMonitor } from '@/hooks/useAdaptiveNetworkMonitor';

// Enable monitoring (runs automatically)
const adaptiveNetwork = useAdaptiveNetworkMonitor(true, 1000); // Monitor every 1 second

// Use the adaptive profile for uploads
const activeProfile = useAdaptiveMode 
  ? adaptiveNetwork.adaptiveProfile 
  : currentProfile;

// Display network status
<NetworkMonitorDisplay networkState={adaptiveNetwork} />
```

### Hook API

```typescript
const {
  metrics,          // Current network metrics
  chunkSize,        // Optimized chunk size
  workers,          // Optimized worker count
  networkType,      // Network type (2G, 3G, 4G, etc.)
  quality,          // Quality classification
  isMonitoring,     // Monitoring status
  adaptiveProfile,  // Complete network profile
  measureNow,       // Trigger immediate measurement
  startMonitoring,  // Start monitoring
  stopMonitoring,   // Stop monitoring
} = useAdaptiveNetworkMonitor(enabled, interval);
```

## Performance Impact

### ✅ Minimal Performance Impact
- **CPU Usage**: <0.1% (runs in Web Worker)
- **Memory**: ~50KB for worker and measurements
- **Network**: Minimal (uses HEAD requests to favicon.ico)
- **Update Frequency**: Configurable (default 1 second)

### 🔋 Battery Considerations
The monitoring is designed to be battery-efficient:
- Lightweight network tests
- Efficient measurement algorithms
- Can be disabled when not needed
- Automatically stops when component unmounts

## Configuration

### Monitoring Interval
```typescript
// Monitor every 2 seconds (less frequent)
useAdaptiveNetworkMonitor(true, 2000);

// Monitor every 500ms (more responsive)
useAdaptiveNetworkMonitor(true, 500);
```

### Enable/Disable
```typescript
const [enabled, setEnabled] = useState(true);
useAdaptiveNetworkMonitor(enabled, 1000);
```

## Browser Compatibility

### Network Information API
- ✅ Chrome/Edge 61+
- ✅ Opera 48+
- ✅ Samsung Internet 8+
- ⚠️ Firefox (partial support)
- ❌ Safari (fallback to measurements)

### Web Workers
- ✅ All modern browsers
- ✅ IE 10+

### Fallback Behavior
When Network Information API is unavailable:
- Falls back to latency-based measurements
- Uses HEAD requests for speed estimation
- Still provides accurate optimization

## Data Saver Mode

When the browser's Data Saver mode is detected:
- Reduces chunk sizes by 30%
- Limits parallel workers
- Shows warning indicator in UI
- Respects user's bandwidth preferences

## Testing

### Manual Testing
1. Enable Adaptive Mode toggle in UI
2. Monitor the network metrics display
3. Test with different network conditions
4. Verify chunk sizes adjust appropriately

### Network Throttling
Use browser DevTools to simulate different networks:
- Fast 4G: Should use ~10MB chunks, 4-8 workers
- Slow 3G: Should use ~512KB chunks, 2 workers
- Offline: Should detect and show errors

## Security Considerations

- Worker runs in isolated context
- No access to DOM or sensitive data
- Uses same-origin policy
- Only performs HEAD requests to safe endpoints

## Future Enhancements

- [ ] Machine learning for pattern prediction
- [ ] Historical network data analysis
- [ ] Geographic location-based optimization
- [ ] Custom test endpoints configuration
- [ ] Detailed network analytics dashboard
- [ ] Adaptive retry strategies based on stability
- [ ] Predictive preloading based on trends

## Troubleshooting

### Worker Not Loading
Ensure the worker file is in the public directory:
```
public/network-monitor.worker.js
```

### Inconsistent Measurements
- Check network stability
- Verify browser DevTools throttling is disabled
- Ensure no other heavy network operations

### High CPU Usage
- Increase monitoring interval
- Check for browser extensions interfering
- Verify worker is not being recreated frequently

## License

Part of the AetherLink project.
